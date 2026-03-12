import { Pool } from "pg"
import type { PgConnectionConfig } from "./connection"

// ── Types ────────────────────────────────────────────────────────────────

export interface ExternalTableInfo {
  schema: string
  name: string
  rowCount: number
  sizeBytes: number
}

export interface TableSelection {
  schema: string
  name: string
}

export interface ColumnDef {
  name: string
  dataType: string
  nullable: boolean
  defaultValue: string | null
  isIdentity: boolean
  identityGeneration: string | null
}

export interface ForeignKeyDef {
  constraintName: string
  columns: string[]
  referencedSchema: string
  referencedTable: string
  referencedColumns: string[]
  onDelete: string
  onUpdate: string
}

export interface UniqueConstraint {
  name: string
  columns: string[]
}

export interface CheckConstraint {
  name: string
  expression: string
}

export interface TableSchema {
  schema: string
  name: string
  columns: ColumnDef[]
  primaryKey: string[] | null
  uniqueConstraints: UniqueConstraint[]
  checkConstraints: CheckConstraint[]
  foreignKeys: ForeignKeyDef[]
}

export interface SequenceInfo {
  sequenceName: string
  columnName: string
  schemaName: string
}

export interface IndexInfo {
  indexName: string
  indexDef: string
}

export interface EnumTypeInfo {
  typeName: string
  schemaName: string
  labels: string[]
}

export interface ForeignKeyDep {
  fromSchema: string
  fromTable: string
  toSchema: string
  toTable: string
}

export interface TableImportProgress {
  schema: string
  table: string
  phase: "schema" | "data" | "indexes" | "sequences" | "done" | "error"
  rowsImported: number
  totalRows: number
  error?: string
}

// ── Connection ───────────────────────────────────────────────────────────

export function createTemporaryPool(config: PgConnectionConfig): Pool {
  return new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database || "postgres",
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  })
}

/** Normalise a PG array_agg result to a JS string array (handles both native arrays and {a,b} strings) */
function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === "string") return val.replace(/^\{|\}$/g, "").split(",")
  return []
}

// ── Schema Introspection ─────────────────────────────────────────────────

export async function listExternalTables(pool: Pool): Promise<ExternalTableInfo[]> {
  const result = await pool.query(`
    SELECT
      n.nspname AS schema,
      c.relname AS name,
      c.reltuples::bigint AS row_count,
      pg_total_relation_size(c.oid) AS size_bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND has_schema_privilege(n.oid, 'USAGE')
      AND has_table_privilege(c.oid, 'SELECT')
    ORDER BY n.nspname, c.relname
  `)
  return result.rows.map((r) => ({
    schema: r.schema,
    name: r.name,
    rowCount: Math.max(0, Number(r.row_count)),
    sizeBytes: Number(r.size_bytes),
  }))
}

export async function getTableSchema(
  pool: Pool,
  schema: string,
  table: string
): Promise<TableSchema> {
  const regclass = `"${schema}"."${table}"`

  // Columns
  const colResult = await pool.query(
    `
    SELECT
      a.attname AS column_name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
      NOT a.attnotnull AS is_nullable,
      pg_get_expr(d.adbin, d.adrelid) AS column_default,
      a.attidentity != '' AS is_identity,
      CASE a.attidentity
        WHEN 'a' THEN 'ALWAYS'
        WHEN 'd' THEN 'BY DEFAULT'
        ELSE NULL
      END AS identity_generation
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE a.attrelid = $1::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attnum
    `,
    [regclass]
  )

  const columns: ColumnDef[] = colResult.rows.map((r) => ({
    name: r.column_name,
    dataType: r.data_type,
    nullable: r.is_nullable,
    defaultValue: r.column_default,
    isIdentity: r.is_identity,
    identityGeneration: r.identity_generation,
  }))

  // Primary key
  const pkResult = await pool.query(
    `
    SELECT array_agg(a.attname ORDER BY x.ordinality) AS columns
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS x(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum
    WHERE c.conrelid = $1::regclass AND c.contype = 'p'
    GROUP BY c.oid
    `,
    [regclass]
  )
  const primaryKey: string[] | null = pkResult.rows[0]?.columns
    ? toStringArray(pkResult.rows[0].columns)
    : null

  // Unique constraints
  const uqResult = await pool.query(
    `
    SELECT
      c.conname AS name,
      array_agg(a.attname ORDER BY x.ordinality) AS columns
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS x(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum
    WHERE c.conrelid = $1::regclass AND c.contype = 'u'
    GROUP BY c.oid, c.conname
    `,
    [regclass]
  )
  const uniqueConstraints: UniqueConstraint[] = uqResult.rows.map((r) => ({
    name: r.name,
    columns: toStringArray(r.columns),
  }))

  // Check constraints (exclude NOT NULL)
  const ckResult = await pool.query(
    `
    SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS expression
    FROM pg_constraint c
    WHERE c.conrelid = $1::regclass
      AND c.contype = 'c'
      AND c.conname NOT LIKE '%_not_null'
    `,
    [regclass]
  )
  const checkConstraints: CheckConstraint[] = ckResult.rows.map((r) => ({
    name: r.name,
    expression: r.expression,
  }))

  // Foreign keys
  const fkResult = await pool.query(
    `
    SELECT
      c.conname AS constraint_name,
      (SELECT array_agg(a.attname ORDER BY ord.n)
       FROM unnest(c.conkey) WITH ORDINALITY AS ord(attnum, n)
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ord.attnum
      ) AS columns,
      nf.nspname AS referenced_schema,
      cf.relname AS referenced_table,
      (SELECT array_agg(af.attname ORDER BY ord.n)
       FROM unnest(c.confkey) WITH ORDINALITY AS ord(attnum, n)
       JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ord.attnum
      ) AS referenced_columns,
      c.confdeltype AS on_delete,
      c.confupdtype AS on_update
    FROM pg_constraint c
    JOIN pg_class cf ON cf.oid = c.confrelid
    JOIN pg_namespace nf ON nf.oid = cf.relnamespace
    WHERE c.conrelid = $1::regclass AND c.contype = 'f'
    `,
    [regclass]
  )

  const actionMap: Record<string, string> = {
    a: "NO ACTION",
    r: "RESTRICT",
    c: "CASCADE",
    n: "SET NULL",
    d: "SET DEFAULT",
  }

  const foreignKeys: ForeignKeyDef[] = fkResult.rows.map((r) => ({
    constraintName: r.constraint_name,
    columns: toStringArray(r.columns),
    referencedSchema: r.referenced_schema,
    referencedTable: r.referenced_table,
    referencedColumns: toStringArray(r.referenced_columns),
    onDelete: actionMap[r.on_delete] || "NO ACTION",
    onUpdate: actionMap[r.on_update] || "NO ACTION",
  }))

  return {
    schema,
    name: table,
    columns,
    primaryKey,
    uniqueConstraints,
    checkConstraints,
    foreignKeys,
  }
}

export async function getTableSequences(
  pool: Pool,
  schema: string,
  table: string
): Promise<SequenceInfo[]> {
  const regclass = `"${schema}"."${table}"`
  const result = await pool.query(
    `
    SELECT
      s.relname AS sequence_name,
      a.attname AS column_name,
      ns.nspname AS schema_name
    FROM pg_depend d
    JOIN pg_class s ON s.oid = d.objid AND s.relkind = 'S'
    JOIN pg_namespace ns ON ns.oid = s.relnamespace
    JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE d.refobjid = $1::regclass
      AND d.deptype = 'a'
    `,
    [regclass]
  )
  return result.rows.map((r) => ({
    sequenceName: r.sequence_name,
    columnName: r.column_name,
    schemaName: r.schema_name,
  }))
}

export async function getTableIndexes(
  pool: Pool,
  schema: string,
  table: string
): Promise<IndexInfo[]> {
  const result = await pool.query(
    `
    SELECT i.indexname, i.indexdef
    FROM pg_indexes i
    WHERE i.schemaname = $1 AND i.tablename = $2
      AND i.indexname NOT IN (
        SELECT c.conname FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        WHERE n.nspname = $1 AND cl.relname = $2
          AND c.contype IN ('p', 'u')
      )
    `,
    [schema, table]
  )
  return result.rows.map((r) => ({
    indexName: r.indexname,
    indexDef: r.indexdef,
  }))
}

export async function getEnumTypes(
  pool: Pool,
  schema: string,
  table: string
): Promise<EnumTypeInfo[]> {
  const regclass = `"${schema}"."${table}"`
  const result = await pool.query(
    `
    SELECT DISTINCT
      t.typname AS type_name,
      n.nspname AS schema_name,
      array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_attribute a
    JOIN pg_type t ON t.oid = a.atttypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE a.attrelid = $1::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND t.typtype = 'e'
    GROUP BY t.typname, n.nspname
    `,
    [regclass]
  )
  return result.rows.map((r) => ({
    typeName: r.type_name,
    schemaName: r.schema_name,
    labels: toStringArray(r.labels),
  }))
}

// ── Dependency Ordering ──────────────────────────────────────────────────

export async function getForeignKeyDependencies(
  pool: Pool,
  tables: TableSelection[]
): Promise<ForeignKeyDep[]> {
  if (tables.length === 0) return []

  // Build a set of selected tables for filtering
  const tableSet = new Set(tables.map((t) => `${t.schema}.${t.name}`))
  const deps: ForeignKeyDep[] = []

  for (const t of tables) {
    const regclass = `"${t.schema}"."${t.name}"`
    try {
      const result = await pool.query(
        `
        SELECT
          nf.nspname AS ref_schema,
          cf.relname AS ref_table
        FROM pg_constraint c
        JOIN pg_class cf ON cf.oid = c.confrelid
        JOIN pg_namespace nf ON nf.oid = cf.relnamespace
        WHERE c.conrelid = $1::regclass AND c.contype = 'f'
        `,
        [regclass]
      )
      for (const r of result.rows) {
        if (tableSet.has(`${r.ref_schema}.${r.ref_table}`)) {
          deps.push({
            fromSchema: t.schema,
            fromTable: t.name,
            toSchema: r.ref_schema,
            toTable: r.ref_table,
          })
        }
      }
    } catch {
      // Skip tables we can't introspect (permission denied, etc.)
    }
  }

  return deps
}

export function orderTablesByDependencies(
  tables: TableSelection[],
  deps: ForeignKeyDep[]
): TableSelection[] {
  const key = (s: string, t: string) => `${s}.${t}`
  const graph = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()

  for (const t of tables) {
    const k = key(t.schema, t.name)
    graph.set(k, new Set())
    inDegree.set(k, 0)
  }

  for (const d of deps) {
    const from = key(d.fromSchema, d.fromTable)
    const to = key(d.toSchema, d.toTable)
    if (from === to) continue // self-ref
    if (!graph.has(to)) continue
    graph.get(to)!.add(from)
    inDegree.set(from, (inDegree.get(from) || 0) + 1)
  }

  // Kahn's algorithm
  const queue: string[] = []
  for (const [k, deg] of inDegree) {
    if (deg === 0) queue.push(k)
  }

  const ordered: string[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    ordered.push(node)
    for (const neighbor of graph.get(node) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  // Any remaining (cycles) get appended at end
  const orderedSet = new Set(ordered)
  for (const t of tables) {
    const k = key(t.schema, t.name)
    if (!orderedSet.has(k)) ordered.push(k)
  }

  const tableMap = new Map(tables.map((t) => [key(t.schema, t.name), t]))
  return ordered.map((k) => tableMap.get(k)!).filter(Boolean)
}

// ── DDL Generation ───────────────────────────────────────────────────────

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export function buildCreateTableSQL(ts: TableSchema): string {
  const parts: string[] = []

  // Columns
  for (const col of ts.columns) {
    let def = `  ${quoteIdent(col.name)} ${col.dataType}`
    if (col.isIdentity && col.identityGeneration) {
      def += ` GENERATED ${col.identityGeneration} AS IDENTITY`
    } else if (col.defaultValue && !col.isIdentity) {
      def += ` DEFAULT ${col.defaultValue}`
    }
    if (!col.nullable) {
      def += " NOT NULL"
    }
    parts.push(def)
  }

  // Primary key
  if (ts.primaryKey && ts.primaryKey.length > 0) {
    parts.push(`  PRIMARY KEY (${ts.primaryKey.map(quoteIdent).join(", ")})`)
  }

  // Unique constraints
  for (const uq of ts.uniqueConstraints) {
    parts.push(
      `  CONSTRAINT ${quoteIdent(uq.name)} UNIQUE (${uq.columns.map(quoteIdent).join(", ")})`
    )
  }

  // Check constraints
  for (const ck of ts.checkConstraints) {
    parts.push(`  CONSTRAINT ${quoteIdent(ck.name)} ${ck.expression}`)
  }

  // FKs are NOT included here — added in final pass
  const qualifiedName = `${quoteIdent(ts.schema)}.${quoteIdent(ts.name)}`
  return `CREATE TABLE ${qualifiedName} (\n${parts.join(",\n")}\n)`
}

export function buildAddForeignKeysSQL(ts: TableSchema): string[] {
  const qualifiedName = `${quoteIdent(ts.schema)}.${quoteIdent(ts.name)}`
  return ts.foreignKeys.map((fk) => {
    const refTable = `${quoteIdent(fk.referencedSchema)}.${quoteIdent(fk.referencedTable)}`
    return `ALTER TABLE ${qualifiedName} ADD CONSTRAINT ${quoteIdent(fk.constraintName)} FOREIGN KEY (${fk.columns.map(quoteIdent).join(", ")}) REFERENCES ${refTable} (${fk.referencedColumns.map(quoteIdent).join(", ")}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
  })
}

// ── Data Transfer ────────────────────────────────────────────────────────

const BATCH_SIZE = 1000

export async function readTableBatch(
  pool: Pool,
  schema: string,
  table: string,
  offset: number,
  batchSize: number = BATCH_SIZE
): Promise<{ rows: Record<string, unknown>[]; columns: string[]; hasMore: boolean }> {
  const qualifiedName = `${quoteIdent(schema)}.${quoteIdent(table)}`
  const result = await pool.query(
    `SELECT * FROM ${qualifiedName} LIMIT ${batchSize + 1} OFFSET ${offset}`
  )
  const columns = result.fields.map((f) => f.name)
  const hasMore = result.rows.length > batchSize
  const rows = hasMore ? result.rows.slice(0, batchSize) : result.rows
  return { rows, columns, hasMore }
}

export async function importTable(
  source: Pool,
  target: Pool,
  table: TableSelection,
  totalRows: number,
  onProgress: (progress: TableImportProgress) => void
): Promise<{ foreignKeys: ForeignKeyDef[] }> {
  const progress: TableImportProgress = {
    schema: table.schema,
    table: table.name,
    phase: "schema",
    rowsImported: 0,
    totalRows,
  }

  try {
    // 1. Create schema
    onProgress({ ...progress, phase: "schema" })
    await target.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(table.schema)}`)

    // 2. Create enum types
    const enums = await getEnumTypes(source, table.schema, table.name)
    for (const e of enums) {
      const safeLabels = toStringArray(e.labels)
      const labels = safeLabels.map((l) => `'${l.replace(/'/g, "''")}'`).join(", ")
      await target.query(
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${e.typeName}') THEN
            CREATE TYPE ${quoteIdent(e.schemaName)}.${quoteIdent(e.typeName)} AS ENUM (${labels});
          END IF;
        END $$`
      )
    }

    // 3. Create sequences
    const sequences = await getTableSequences(source, table.schema, table.name)
    for (const seq of sequences) {
      await target.query(
        `CREATE SEQUENCE IF NOT EXISTS ${quoteIdent(seq.schemaName)}.${quoteIdent(seq.sequenceName)}`
      )
    }

    // 4. Get schema and create table
    const tableSchema = await getTableSchema(source, table.schema, table.name)
    const createSQL = buildCreateTableSQL(tableSchema)
    await target.query(createSQL)

    // 5. Copy data in batches
    progress.phase = "data"
    onProgress({ ...progress })

    // Build column type map for JSON/JSONB handling
    const colTypeMap = new Map<string, string>()
    for (const col of tableSchema.columns) {
      colTypeMap.set(col.name, col.dataType.toLowerCase())
    }

    let offset = 0
    let hasMore = true
    while (hasMore) {
      const batch = await readTableBatch(source, table.schema, table.name, offset)
      if (batch.rows.length === 0) break

      // Build multi-row INSERT
      const cols = batch.columns
      const placeholders: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      for (const row of batch.rows) {
        const rowPlaceholders: string[] = []
        for (const col of cols) {
          const colType = colTypeMap.get(col) ?? ""
          const isJson = colType === "json" || colType === "jsonb"
          const val = row[col]

          if (isJson && val != null) {
            // pg driver parses JSON into JS values on read (objects, arrays,
            // strings, numbers, booleans); always re-stringify for insert
            params.push(typeof val === "string" ? val : JSON.stringify(val))
          } else {
            params.push(val)
          }

          if (isJson) {
            rowPlaceholders.push(`$${paramIndex++}::${colType}`)
          } else {
            rowPlaceholders.push(`$${paramIndex++}`)
          }
        }
        placeholders.push(`(${rowPlaceholders.join(", ")})`)
      }

      const qualifiedName = `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`
      const insertSQL = `INSERT INTO ${qualifiedName} (${cols.map(quoteIdent).join(", ")}) VALUES ${placeholders.join(", ")}`
      await target.query(insertSQL, params)

      progress.rowsImported += batch.rows.length
      onProgress({ ...progress })

      offset += BATCH_SIZE
      hasMore = batch.hasMore
    }

    // 6. Reset sequences
    progress.phase = "sequences"
    onProgress({ ...progress })
    for (const seq of sequences) {
      try {
        await target.query(
          `SELECT setval(
            '${quoteIdent(seq.schemaName)}.${quoteIdent(seq.sequenceName)}',
            COALESCE((SELECT MAX(${quoteIdent(seq.columnName)}) FROM ${quoteIdent(table.schema)}.${quoteIdent(table.name)}), 1)
          )`
        )
      } catch {
        // Non-fatal: sequence reset failure
      }
    }

    // 7. Create indexes
    progress.phase = "indexes"
    onProgress({ ...progress })
    const indexes = await getTableIndexes(source, table.schema, table.name)
    for (const idx of indexes) {
      try {
        await target.query(idx.indexDef)
      } catch {
        // Non-fatal: index creation failure (may reference extensions etc.)
      }
    }

    progress.phase = "done"
    onProgress({ ...progress })

    return { foreignKeys: tableSchema.foreignKeys }
  } catch (error) {
    progress.phase = "error"
    progress.error = (error as Error).message
    onProgress({ ...progress })
    throw error
  }
}
