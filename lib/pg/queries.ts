import type { Pool } from "pg"

export async function listDatabases(pool: Pool) {
  const result = await pool.query(`
    SELECT
      d.datname AS name,
      r.rolname AS owner,
      pg_encoding_to_char(d.encoding) AS encoding,
      pg_database_size(d.datname) AS size_bytes,
      d.datcollate AS collation,
      (SELECT min(xact_start) FROM pg_stat_activity WHERE datname = d.datname) AS oldest_xact
    FROM pg_database d
    JOIN pg_roles r ON d.datdba = r.oid
    WHERE d.datistemplate = false
    ORDER BY d.datname
  `)
  return result.rows
}

export async function getDatabaseInfo(pool: Pool, dbName: string) {
  const result = await pool.query(
    `
    SELECT
      d.datname AS name,
      r.rolname AS owner,
      pg_encoding_to_char(d.encoding) AS encoding,
      pg_database_size(d.datname) AS size_bytes,
      d.datcollate AS collation
    FROM pg_database d
    JOIN pg_roles r ON d.datdba = r.oid
    WHERE d.datname = $1
  `,
    [dbName]
  )
  return result.rows[0] || null
}

export async function createDatabase(
  pool: Pool,
  name: string,
  owner: string,
  encoding: string
) {
  // Database names, owners, encodings cannot be parameterized in CREATE DATABASE
  // Validate inputs to prevent SQL injection
  const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeOwner = owner.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeEncoding = encoding.replace(/[^a-zA-Z0-9_]/g, "_")

  await pool.query(
    `CREATE DATABASE "${safeName}" OWNER "${safeOwner}" ENCODING '${safeEncoding}'`
  )

  // Revoke default CONNECT from public so only explicitly granted users
  // (and the owner) can access this database.
  await pool.query(`REVOKE CONNECT ON DATABASE "${safeName}" FROM PUBLIC`)

  // Grant full database-level privileges (CREATE lets owner create new schemas,
  // e.g. Drizzle's "drizzle" migration-tracking schema).
  await pool.query(`GRANT ALL PRIVILEGES ON DATABASE "${safeName}" TO "${safeOwner}"`)

  // PG 15+ revoked default CREATE on public schema — grant access on ALL
  // existing non-system schemas (not just public) so the owner can use schemas
  // inherited from template1 or created by other roles.
  const dbPool = await getDbPool(pool, safeName)
  try {
    await grantAllSchemas(dbPool, safeOwner)
  } finally {
    await dbPool.end()
  }
}

export async function dropDatabase(pool: Pool, name: string) {
  const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_")
  // Terminate connections first
  await pool.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [safeName]
  )
  await pool.query(`DROP DATABASE "${safeName}"`)
}

export async function listPgUsers(pool: Pool) {
  const result = await pool.query(`
    SELECT
      r.rolname AS username,
      r.rolcanlogin AS can_login,
      r.rolsuper AS superuser,
      r.rolcreatedb AS create_db,
      r.rolcreaterole AS create_role,
      r.oid
    FROM pg_roles r
    WHERE r.rolname NOT LIKE 'pg_%'
    ORDER BY r.rolname
  `)

  // Get database access for each user
  const dbResult = await pool.query(`
    SELECT datname FROM pg_database WHERE datistemplate = false
  `)

  for (const user of result.rows) {
    const accessibleDbs: string[] = []
    for (const db of dbResult.rows) {
      const check = await pool.query(
        `SELECT has_database_privilege($1, $2, 'CONNECT') AS has_access`,
        [user.username, db.datname]
      )
      if (check.rows[0]?.has_access) {
        accessibleDbs.push(db.datname)
      }
    }
    user.databases = accessibleDbs
  }

  return result.rows
}

export async function createPgUser(
  pool: Pool,
  username: string,
  password: string,
  options: { superuser?: boolean; canLogin?: boolean } = {}
) {
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_")
  const { superuser = false, canLogin = true } = options

  let sql = `CREATE ROLE "${safeUsername}"`
  const attrs: string[] = []
  if (canLogin) attrs.push("LOGIN")
  if (superuser) attrs.push("SUPERUSER")
  attrs.push(`PASSWORD '${password.replace(/'/g, "''")}'`)

  if (attrs.length > 0) {
    sql += ` ${attrs.join(" ")}`
  }

  await pool.query(sql)
}

export async function dropPgUser(pool: Pool, username: string) {
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_")
  await pool.query(`DROP ROLE "${safeUsername}"`)
}

export async function updatePgUser(
  pool: Pool,
  username: string,
  updates: { canLogin?: boolean; superuser?: boolean; password?: string }
) {
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_")
  const attrs: string[] = []

  if (updates.canLogin !== undefined) {
    attrs.push(updates.canLogin ? "LOGIN" : "NOLOGIN")
  }
  if (updates.superuser !== undefined) {
    attrs.push(updates.superuser ? "SUPERUSER" : "NOSUPERUSER")
  }
  if (updates.password) {
    attrs.push(`PASSWORD '${updates.password.replace(/'/g, "''")}'`)
  }

  if (attrs.length > 0) {
    await pool.query(`ALTER ROLE "${safeUsername}" ${attrs.join(" ")}`)
  }
}

// Grant ALL on every non-system schema in the target database: schema-level
// privileges, existing objects, and default privileges for future objects.
// Handles schemas created by imports/restores (owned by admin) and
// PG 15+ public-schema restrictions.
async function grantAllSchemas(dbPool: Pool, safeRole: string) {
  const { rows } = await dbPool.query(`
    SELECT nspname FROM pg_namespace
    WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
  `)
  for (const row of rows) {
    const schema = (row.nspname as string).replace(/[^a-zA-Z0-9_]/g, "_")
    await dbPool.query(`GRANT ALL ON SCHEMA "${schema}" TO "${safeRole}"`)
    // Grant on existing objects (e.g. tables created during import/restore)
    await dbPool.query(`GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO "${safeRole}"`)
    await dbPool.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA "${schema}" TO "${safeRole}"`)
    // Grant on future objects created by the admin role in this schema
    await dbPool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT ALL ON TABLES TO "${safeRole}"`)
    await dbPool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT ALL ON SEQUENCES TO "${safeRole}"`)
  }
  // Also cover future schemas created by the admin role
  await dbPool.query(`ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO "${safeRole}"`)
  await dbPool.query(`ALTER DEFAULT PRIVILEGES GRANT ALL ON SEQUENCES TO "${safeRole}"`)
}

// Get a short-lived pool connected to a specific database, inheriting
// credentials from an existing pool (pool.options drops password/ssl,
// so we grab them from an actual client connection).
async function getDbPool(pool: Pool, dbName: string): Promise<Pool> {
  const client = await pool.connect()
  try {
    const { host, port, user, password, ssl } = client as any
    const { Pool: PgPool } = await import("pg")
    return new PgPool({
      host,
      port,
      user,
      password,
      database: dbName,
      max: 1,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
    })
  } finally {
    client.release()
  }
}

// Re-apply schema-level grants to all non-system roles that have access
// to the database. Call this after import or restore operations that may
// have created schemas/tables owned by the admin (postgres) user.
export async function regrantDatabaseSchemas(pool: Pool, dbName: string) {
  const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "_")

  // Find all non-system, non-superuser roles with CREATE privilege on this DB.
  // This catches the owner (implicit CREATE) and roles explicitly granted
  // via grantAccess (ALL PRIVILEGES). Using CREATE avoids picking up every
  // role via PUBLIC's default CONNECT privilege.
  const { rows } = await pool.query(
    `SELECT r.rolname
     FROM pg_roles r
     WHERE r.rolname NOT LIKE 'pg_%'
       AND r.rolname <> 'postgres'
       AND NOT r.rolsuper
       AND has_database_privilege(r.rolname, $1, 'CREATE')`,
    [safeName]
  )
  if (rows.length === 0) return

  const dbPool = await getDbPool(pool, safeName)
  try {
    for (const row of rows) {
      const safeRole = (row.rolname as string).replace(/[^a-zA-Z0-9_]/g, "_")
      await grantAllSchemas(dbPool, safeRole)
    }
  } finally {
    await dbPool.end()
  }
}

export async function grantAccess(
  pool: Pool,
  username: string,
  dbName: string
) {
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeDbName = dbName.replace(/[^a-zA-Z0-9_]/g, "_")

  // Grant full database-level privileges so the user can run migrations,
  // create schemas (e.g. Drizzle's "drizzle" schema), tables, etc.
  await pool.query(`GRANT ALL PRIVILEGES ON DATABASE "${safeDbName}" TO "${safeUsername}"`)

  // Grant on all existing non-system schemas (not just public) so the user
  // can use schemas inherited from template1 or created by other roles.
  const dbPool = await getDbPool(pool, safeDbName)
  try {
    await grantAllSchemas(dbPool, safeUsername)
  } finally {
    await dbPool.end()
  }
}

export async function revokeAccess(
  pool: Pool,
  username: string,
  dbName: string
) {
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeDbName = dbName.replace(/[^a-zA-Z0-9_]/g, "_")
  await pool.query(`REVOKE ALL PRIVILEGES ON DATABASE "${safeDbName}" FROM "${safeUsername}"`)

  // Revoke schema-level privileges on ALL non-system schemas (matches grantAccess)
  const dbPool = await getDbPool(pool, safeDbName)
  try {
    const { rows } = await dbPool.query(`
      SELECT nspname FROM pg_namespace
      WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
    `)
    for (const row of rows) {
      const schema = (row.nspname as string).replace(/[^a-zA-Z0-9_]/g, "_")
      await dbPool.query(`REVOKE ALL ON SCHEMA "${schema}" FROM "${safeUsername}"`)
      await dbPool.query(`REVOKE ALL ON ALL TABLES IN SCHEMA "${schema}" FROM "${safeUsername}"`)
      await dbPool.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA "${schema}" FROM "${safeUsername}"`)
      await dbPool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" REVOKE ALL ON TABLES FROM "${safeUsername}"`)
      await dbPool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" REVOKE ALL ON SEQUENCES FROM "${safeUsername}"`)
    }
    await dbPool.query(`ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM "${safeUsername}"`)
    await dbPool.query(`ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM "${safeUsername}"`)
  } finally {
    await dbPool.end()
  }
}

// Revoke default CONNECT from public on ALL existing non-template databases.
// This ensures only explicitly granted users (and superusers/owners) can connect.
// Safe to run multiple times — revoking an already-revoked privilege is a no-op.
export async function lockdownPublicConnect(pool: Pool) {
  const { rows } = await pool.query(`
    SELECT datname FROM pg_database WHERE datistemplate = false
  `)
  for (const row of rows) {
    const safeName = (row.datname as string).replace(/[^a-zA-Z0-9_]/g, "_")
    await pool.query(`REVOKE CONNECT ON DATABASE "${safeName}" FROM PUBLIC`)
  }
}

export async function listTables(pool: Pool) {
  const result = await pool.query(`
    SELECT
      t.table_schema AS schema,
      t.table_name AS name,
      (SELECT reltuples::bigint FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname = t.table_name AND n.nspname = t.table_schema) AS row_count
    FROM information_schema.tables t
    WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_schema, t.table_name
  `)
  return result.rows
}

export async function getTableColumns(
  pool: Pool,
  schema: string,
  table: string
) {
  const result = await pool.query(
    `
    SELECT
      c.column_name AS name,
      c.data_type AS type,
      c.udt_name AS udt_type,
      c.character_maximum_length AS max_length,
      c.is_nullable = 'YES' AS nullable,
      c.column_default AS default_value,
      EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = c.table_schema
          AND tc.table_name = c.table_name
          AND kcu.column_name = c.column_name
      ) AS is_primary_key
    FROM information_schema.columns c
    WHERE c.table_schema = $1 AND c.table_name = $2
    ORDER BY c.ordinal_position
  `,
    [schema, table]
  )
  return result.rows
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTime: number
  command: string
}

export async function executeSQL(
  pool: Pool,
  sql: string
): Promise<QueryResult> {
  const start = performance.now()
  const result = await pool.query(sql)
  const executionTime = Math.round(performance.now() - start)

  const columns = result.fields?.map((f) => f.name) || []
  const rows = result.rows || []

  return {
    columns,
    rows,
    rowCount: result.rowCount ?? rows.length,
    executionTime,
    command: result.command || "UNKNOWN",
  }
}

// ── Table Data CRUD ──────────────────────────────────────────────────────

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export interface TableFilter {
  column: string
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "like"
    | "ilike"
    | "is_null"
    | "is_not_null"
  value?: string
}

interface GetTableRowsOptions {
  page?: number
  pageSize?: number
  filters?: TableFilter[]
  sort?: string
  sortDir?: "asc" | "desc"
  columns?: string[]
}

function buildWhereClause(
  filters: TableFilter[],
  startParam: number
): { sql: string; params: unknown[] } {
  if (filters.length === 0) return { sql: "", params: [] }

  const conditions: string[] = []
  const params: unknown[] = []
  let paramIdx = startParam

  for (const f of filters) {
    const col = quoteIdent(f.column)
    switch (f.operator) {
      case "eq":
        conditions.push(`${col} = $${paramIdx++}`)
        params.push(f.value)
        break
      case "neq":
        conditions.push(`${col} != $${paramIdx++}`)
        params.push(f.value)
        break
      case "gt":
        conditions.push(`${col} > $${paramIdx++}`)
        params.push(f.value)
        break
      case "gte":
        conditions.push(`${col} >= $${paramIdx++}`)
        params.push(f.value)
        break
      case "lt":
        conditions.push(`${col} < $${paramIdx++}`)
        params.push(f.value)
        break
      case "lte":
        conditions.push(`${col} <= $${paramIdx++}`)
        params.push(f.value)
        break
      case "like":
        conditions.push(`${col}::text LIKE $${paramIdx++}`)
        params.push(f.value)
        break
      case "ilike":
        conditions.push(`${col}::text ILIKE $${paramIdx++}`)
        params.push(f.value)
        break
      case "is_null":
        conditions.push(`${col} IS NULL`)
        break
      case "is_not_null":
        conditions.push(`${col} IS NOT NULL`)
        break
    }
  }

  return { sql: `WHERE ${conditions.join(" AND ")}`, params }
}

export async function getTableRows(
  pool: Pool,
  schema: string,
  table: string,
  options: GetTableRowsOptions = {}
) {
  const {
    page = 1,
    pageSize = 50,
    filters = [],
    sort,
    sortDir = "asc",
    columns,
  } = options

  const qualifiedTable = `${quoteIdent(schema)}.${quoteIdent(table)}`
  const selectCols = columns?.length
    ? columns.map(quoteIdent).join(", ")
    : "*"

  const where = buildWhereClause(filters, 1)
  const offset = (page - 1) * pageSize

  const orderBy = sort
    ? `ORDER BY ${quoteIdent(sort)} ${sortDir === "desc" ? "DESC" : "ASC"} NULLS LAST`
    : ""

  const limitOffset = `LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`

  const start = performance.now()

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT ${selectCols} FROM ${qualifiedTable} ${where.sql} ${orderBy} ${limitOffset}`,
      [...where.params, pageSize, offset]
    ),
    pool.query(
      `SELECT count(*) AS total FROM ${qualifiedTable} ${where.sql}`,
      where.params
    ),
  ])

  const executionTime = Math.round(performance.now() - start)

  return {
    rows: dataResult.rows,
    columns: dataResult.fields.map((f) => f.name),
    totalCount: parseInt(countResult.rows[0].total, 10),
    page,
    pageSize,
    executionTime,
  }
}

export async function getTablePrimaryKeys(
  pool: Pool,
  schema: string,
  table: string
): Promise<string[]> {
  const result = await pool.query(
    `
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = $1
      AND tc.table_name = $2
    ORDER BY kcu.ordinal_position
    `,
    [schema, table]
  )
  return result.rows.map((r) => r.column_name)
}

export async function insertTableRow(
  pool: Pool,
  schema: string,
  table: string,
  data: Record<string, unknown>
) {
  const cols = Object.keys(data)
  if (cols.length === 0) throw new Error("No data to insert")

  const qualifiedTable = `${quoteIdent(schema)}.${quoteIdent(table)}`
  const colNames = cols.map(quoteIdent).join(", ")
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ")
  const values = cols.map((c) => data[c])

  const result = await pool.query(
    `INSERT INTO ${qualifiedTable} (${colNames}) VALUES (${placeholders}) RETURNING *`,
    values
  )
  return result.rows[0]
}

export async function updateTableRow(
  pool: Pool,
  schema: string,
  table: string,
  pkValues: Record<string, unknown>,
  data: Record<string, unknown>
) {
  const pkCols = Object.keys(pkValues)
  const dataCols = Object.keys(data)
  if (pkCols.length === 0) throw new Error("Primary key required for update")
  if (dataCols.length === 0) throw new Error("No data to update")

  const qualifiedTable = `${quoteIdent(schema)}.${quoteIdent(table)}`
  let paramIdx = 1

  const setClauses = dataCols.map((c) => `${quoteIdent(c)} = $${paramIdx++}`).join(", ")
  const whereClauses = pkCols.map((c) => `${quoteIdent(c)} = $${paramIdx++}`).join(" AND ")
  const values = [...dataCols.map((c) => data[c]), ...pkCols.map((c) => pkValues[c])]

  const result = await pool.query(
    `UPDATE ${qualifiedTable} SET ${setClauses} WHERE ${whereClauses} RETURNING *`,
    values
  )
  return result.rows[0]
}

export async function deleteTableRows(
  pool: Pool,
  schema: string,
  table: string,
  pkValueSets: Record<string, unknown>[]
) {
  if (pkValueSets.length === 0) throw new Error("No rows to delete")
  if (pkValueSets.length > 100) throw new Error("Cannot delete more than 100 rows at once")

  const pkCols = Object.keys(pkValueSets[0])
  if (pkCols.length === 0) throw new Error("Primary key required for delete")

  const qualifiedTable = `${quoteIdent(schema)}.${quoteIdent(table)}`
  let paramIdx = 1
  const conditions: string[] = []
  const params: unknown[] = []

  for (const pkSet of pkValueSets) {
    const rowCondition = pkCols
      .map((c) => `${quoteIdent(c)} = $${paramIdx++}`)
      .join(" AND ")
    conditions.push(`(${rowCondition})`)
    pkCols.forEach((c) => params.push(pkSet[c]))
  }

  const result = await pool.query(
    `DELETE FROM ${qualifiedTable} WHERE ${conditions.join(" OR ")}`,
    params
  )
  return { deletedCount: result.rowCount ?? 0 }
}

export async function getServerInfo(pool: Pool) {
  const versionResult = await pool.query("SELECT version()")
  const uptimeResult = await pool.query(
    "SELECT (now() - pg_postmaster_start_time())::text AS uptime"
  )
  const maxConnResult = await pool.query("SHOW max_connections")
  const activeConnResult = await pool.query(
    "SELECT count(*) AS count FROM pg_stat_activity"
  )

  const versionString = versionResult.rows[0].version as string
  const versionMatch = versionString.match(/PostgreSQL (\d+\.\d+)/)

  return {
    version: versionMatch ? versionMatch[1] : versionString,
    fullVersion: versionString,
    uptime: uptimeResult.rows[0].uptime,
    maxConnections: parseInt(maxConnResult.rows[0].max_connections, 10),
    activeConnections: parseInt(activeConnResult.rows[0].count, 10),
  }
}
