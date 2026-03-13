import type { Pool } from "pg"

/**
 * Safely escape a string literal for embedding in SQL DDL statements
 * where parameterized queries ($1) are not supported (e.g. CREATE ROLE ... PASSWORD).
 * Mirrors the pg library's Client.escapeLiteral() implementation.
 */
function escapeLiteral(str: string): string {
  let hasBackslash = false
  let escaped = "'"
  for (const c of str) {
    if (c === "'") {
      escaped += "''"
    } else if (c === "\\") {
      escaped += "\\\\"
      hasBackslash = true
    } else {
      escaped += c
    }
  }
  escaped += "'"
  if (hasBackslash) {
    escaped = " E" + escaped
  }
  return escaped
}

export async function listDatabases(pool: Pool) {
  const result = await pool.query(`
    SELECT
      d.datname AS name,
      r.rolname AS owner,
      pg_encoding_to_char(d.encoding) AS encoding,
      pg_database_size(d.datname) AS size_bytes,
      d.datcollate AS collation,
      COALESCE(s.numbackends, 0)::int AS active_connections,
      COALESCE(s.xact_commit, 0)::bigint AS xact_commit,
      COALESCE(s.xact_rollback, 0)::bigint AS xact_rollback,
      CASE WHEN COALESCE(s.blks_hit, 0) + COALESCE(s.blks_read, 0) = 0 THEN 0
           ELSE ROUND(100.0 * s.blks_hit / (s.blks_hit + s.blks_read), 1)
      END AS cache_hit_ratio,
      COALESCE(s.tup_returned, 0)::bigint AS tup_returned,
      COALESCE(s.tup_fetched, 0)::bigint AS tup_fetched,
      COALESCE(s.tup_inserted, 0)::bigint AS tup_inserted,
      COALESCE(s.tup_updated, 0)::bigint AS tup_updated,
      COALESCE(s.tup_deleted, 0)::bigint AS tup_deleted
    FROM pg_database d
    JOIN pg_roles r ON d.datdba = r.oid
    LEFT JOIN pg_stat_database s ON s.datname = d.datname
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
  attrs.push(`PASSWORD ${escapeLiteral(password)}`)

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
    attrs.push(`PASSWORD ${escapeLiteral(updates.password)}`)
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
    // Transfer ownership of existing tables/sequences so the role can run DDL (ALTER TABLE, etc.)
    await dbPool.query(`
      DO $$ DECLARE r RECORD; BEGIN
        FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = '${schema}'
                   AND tableowner <> '${safeRole}'
        LOOP EXECUTE format('ALTER TABLE "${schema}".%I OWNER TO "${safeRole}"', r.tablename); END LOOP;
        FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = '${schema}'
                   AND sequenceowner <> '${safeRole}'
        LOOP EXECUTE format('ALTER SEQUENCE "${schema}".%I OWNER TO "${safeRole}"', r.sequencename); END LOOP;
      END $$;
    `)
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

// ── Database-level privilege introspection & management ───────────────

export interface DatabaseUserPrivileges {
  username: string
  is_owner: boolean
  superuser: boolean
  can_login: boolean
  connect: boolean
  create: boolean
  temporary: boolean
  connection_limit: number // -1 = unlimited
}

/**
 * Get per-user privilege breakdown for a specific database.
 * Returns every non-system role that has at least CONNECT,
 * plus the owner and superusers.
 */
export async function getDatabasePrivileges(
  pool: Pool,
  dbName: string
): Promise<DatabaseUserPrivileges[]> {
  const result = await pool.query(
    `
    SELECT
      r.rolname                                          AS username,
      r.rolsuper                                         AS superuser,
      r.rolcanlogin                                      AS can_login,
      r.rolconnlimit                                     AS connection_limit,
      (d.datdba = r.oid)                                 AS is_owner,
      has_database_privilege(r.oid, d.oid, 'CONNECT')    AS connect,
      has_database_privilege(r.oid, d.oid, 'CREATE')     AS "create",
      has_database_privilege(r.oid, d.oid, 'TEMPORARY')  AS temporary
    FROM pg_roles r
    CROSS JOIN pg_database d
    WHERE d.datname = $1
      AND r.rolname NOT LIKE 'pg_%'
    ORDER BY
      (d.datdba = r.oid) DESC,  -- owner first
      r.rolsuper DESC,           -- then superusers
      r.rolname ASC
    `,
    [dbName]
  )
  // Only return roles that actually have some form of access
  return result.rows.filter(
    (r: DatabaseUserPrivileges) => r.connect || r.create || r.temporary || r.is_owner || r.superuser
  )
}

export interface UserDatabasePrivileges {
  username: string
  database: string
  is_owner: boolean
  superuser: boolean
  connect: boolean
  create: boolean
  temporary: boolean
}

/**
 * Get privilege breakdown for every user across all databases.
 * Returns rows where the user has at least one privilege.
 */
export async function listAllUserPrivileges(
  pool: Pool
): Promise<UserDatabasePrivileges[]> {
  const result = await pool.query(`
    SELECT
      r.rolname                                          AS username,
      d.datname                                          AS database,
      r.rolsuper                                         AS superuser,
      (d.datdba = r.oid)                                 AS is_owner,
      has_database_privilege(r.oid, d.oid, 'CONNECT')    AS connect,
      has_database_privilege(r.oid, d.oid, 'CREATE')     AS "create",
      has_database_privilege(r.oid, d.oid, 'TEMPORARY')  AS temporary
    FROM pg_roles r
    CROSS JOIN pg_database d
    WHERE d.datistemplate = false
      AND r.rolname NOT LIKE 'pg_%'
    ORDER BY r.rolname, d.datname
  `)
  return result.rows.filter(
    (r: UserDatabasePrivileges) =>
      r.connect || r.create || r.temporary || r.is_owner || r.superuser
  )
}

const VALID_DB_PRIVILEGES = ["CONNECT", "CREATE", "TEMPORARY"] as const
type DbPrivilege = (typeof VALID_DB_PRIVILEGES)[number]

export async function grantDatabasePrivilege(
  pool: Pool,
  username: string,
  dbName: string,
  privilege: string
) {
  const priv = privilege.toUpperCase() as DbPrivilege
  if (!VALID_DB_PRIVILEGES.includes(priv)) {
    throw new Error(`Invalid privilege: ${privilege}`)
  }
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeDbName = dbName.replace(/[^a-zA-Z0-9_]/g, "_")
  await pool.query(`GRANT ${priv} ON DATABASE "${safeDbName}" TO "${safeUsername}"`)

  // If granting CREATE, also grant schema-level privileges so the user
  // can actually use schemas and objects within the database.
  if (priv === "CREATE") {
    const dbPool = await getDbPool(pool, safeDbName)
    try {
      await grantAllSchemas(dbPool, safeUsername)
    } finally {
      await dbPool.end()
    }
  }
}

export async function revokeDatabasePrivilege(
  pool: Pool,
  username: string,
  dbName: string,
  privilege: string
) {
  const priv = privilege.toUpperCase() as DbPrivilege
  if (!VALID_DB_PRIVILEGES.includes(priv)) {
    throw new Error(`Invalid privilege: ${privilege}`)
  }
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeDbName = dbName.replace(/[^a-zA-Z0-9_]/g, "_")
  await pool.query(`REVOKE ${priv} ON DATABASE "${safeDbName}" FROM "${safeUsername}"`)

  // If revoking CREATE, also revoke schema-level privileges
  if (priv === "CREATE") {
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
      }
    } finally {
      await dbPool.end()
    }
  }
}

export async function updateConnectionLimit(
  pool: Pool,
  username: string,
  limit: number
) {
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_")
  await pool.query(`ALTER ROLE "${safeUsername}" CONNECTION LIMIT ${limit}`)
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
       WHERE c.relname = t.table_name AND n.nspname = t.table_schema) AS row_count,
      (SELECT tableowner FROM pg_tables pt
       WHERE pt.schemaname = t.table_schema AND pt.tablename = t.table_name) AS owner
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

// ── Connection activity (pg_stat_activity) ────────────────────────────

export interface ConnectionActivity {
  pid: number
  usename: string | null
  application_name: string
  client_addr: string | null
  state: string | null
  query: string | null
  query_start: string | null
  state_change: string | null
  backend_start: string | null
  wait_event_type: string | null
  wait_event: string | null
}

export async function listDatabaseActivity(
  pool: Pool,
  dbName: string
): Promise<ConnectionActivity[]> {
  const result = await pool.query(
    `
    SELECT
      pid,
      usename,
      application_name,
      client_addr::text,
      state,
      LEFT(query, 200) AS query,
      query_start::text,
      state_change::text,
      backend_start::text,
      wait_event_type,
      wait_event
    FROM pg_stat_activity
    WHERE datname = $1
      AND pid <> pg_backend_pid()
    ORDER BY
      CASE state WHEN 'active' THEN 0 WHEN 'idle in transaction' THEN 1 ELSE 2 END,
      backend_start ASC
    `,
    [dbName]
  )
  return result.rows
}

export async function terminateBackend(pool: Pool, pid: number): Promise<boolean> {
  const result = await pool.query(
    `SELECT pg_terminate_backend($1) AS terminated`,
    [pid]
  )
  return result.rows[0]?.terminated ?? false
}

// ── pg_stat_statements (server-level query tracking) ──────────────────

export interface PgStatStatementEntry {
  queryid: string
  query: string
  calls: number
  total_exec_time: number
  mean_exec_time: number
  min_exec_time: number
  max_exec_time: number
  rows: number
  shared_blks_hit: number
  shared_blks_read: number
  dbname: string | null
  rolname: string | null
}

/**
 * Check whether pg_stat_statements extension is available on the server
 * (listed in shared_preload_libraries) and whether the extension is
 * installed in the current database.
 */
export async function checkPgStatStatements(pool: Pool): Promise<{
  preloaded: boolean
  installed: boolean
}> {
  // Check if it's in shared_preload_libraries
  const preloadResult = await pool.query(
    `SELECT setting FROM pg_settings WHERE name = 'shared_preload_libraries'`
  )
  const preloaded = (preloadResult.rows[0]?.setting ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .includes("pg_stat_statements")

  // Check if the extension is installed in the current database
  const extResult = await pool.query(
    `SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`
  )
  const installed = extResult.rows.length > 0

  return { preloaded, installed }
}

/**
 * Try to install pg_stat_statements extension. Returns true if successful.
 * Requires that pg_stat_statements is listed in shared_preload_libraries.
 */
export async function enablePgStatStatements(pool: Pool): Promise<boolean> {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`)
    return true
  } catch {
    return false
  }
}

/**
 * Fetch aggregated query statistics from pg_stat_statements.
 * Optionally filter by database name.
 */
export async function getPgStatStatements(
  pool: Pool,
  opts: { database?: string; limit?: number; search?: string } = {}
): Promise<PgStatStatementEntry[]> {
  const { database, limit = 100, search } = opts
  const params: unknown[] = []
  const conditions: string[] = []
  let paramIdx = 1

  if (database) {
    conditions.push(`d.datname = $${paramIdx++}`)
    params.push(database)
  }

  if (search) {
    conditions.push(`s.query ILIKE $${paramIdx++}`)
    params.push(`%${search}%`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  params.push(limit)

  const result = await pool.query(
    `
    SELECT
      s.queryid::text AS queryid,
      LEFT(s.query, 2000) AS query,
      s.calls::bigint AS calls,
      ROUND(s.total_exec_time::numeric, 2) AS total_exec_time,
      ROUND(s.mean_exec_time::numeric, 2) AS mean_exec_time,
      ROUND(s.min_exec_time::numeric, 2) AS min_exec_time,
      ROUND(s.max_exec_time::numeric, 2) AS max_exec_time,
      s.rows::bigint AS rows,
      s.shared_blks_hit::bigint AS shared_blks_hit,
      s.shared_blks_read::bigint AS shared_blks_read,
      d.datname AS dbname,
      r.rolname AS rolname
    FROM pg_stat_statements s
    LEFT JOIN pg_database d ON d.oid = s.dbid
    LEFT JOIN pg_roles r ON r.oid = s.userid
    ${where}
    ORDER BY s.total_exec_time DESC
    LIMIT $${paramIdx}
    `,
    params
  )
  return result.rows
}

/**
 * Reset all pg_stat_statements counters.
 */
export async function resetPgStatStatements(pool: Pool): Promise<void> {
  await pool.query(`SELECT pg_stat_statements_reset()`)
}

// ── Table-level privilege introspection & management ──────────────────

export interface TablePrivilegeRow {
  schema: string
  table_name: string
  table_owner: string
  username: string
  superuser: boolean
  is_table_owner: boolean
  select: boolean
  insert: boolean
  update: boolean
  delete: boolean
  truncate: boolean
  references: boolean
  trigger: boolean
}

/**
 * Get per-user privilege breakdown for all tables in the current database.
 * Must be called on a pool connected to the target database (not postgres).
 */
export async function getTablePrivileges(pool: Pool): Promise<TablePrivilegeRow[]> {
  const result = await pool.query(`
    SELECT
      t.schemaname AS schema,
      t.tablename AS table_name,
      t.tableowner AS table_owner,
      r.rolname AS username,
      r.rolsuper AS superuser,
      (t.tableowner = r.rolname) AS is_table_owner,
      has_table_privilege(r.oid, (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass, 'SELECT') AS "select",
      has_table_privilege(r.oid, (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass, 'INSERT') AS "insert",
      has_table_privilege(r.oid, (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass, 'UPDATE') AS "update",
      has_table_privilege(r.oid, (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass, 'DELETE') AS "delete",
      has_table_privilege(r.oid, (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass, 'TRUNCATE') AS "truncate",
      has_table_privilege(r.oid, (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass, 'REFERENCES') AS "references",
      has_table_privilege(r.oid, (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass, 'TRIGGER') AS "trigger"
    FROM pg_tables t
    CROSS JOIN pg_roles r
    WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema')
      AND r.rolname NOT LIKE 'pg_%'
      AND r.rolcanlogin = true
    ORDER BY t.schemaname, t.tablename, r.rolname
  `)
  return result.rows
}

const VALID_TABLE_PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"] as const
type TablePrivilege = (typeof VALID_TABLE_PRIVILEGES)[number]

export async function grantTablePrivilege(
  pool: Pool,
  username: string,
  schema: string,
  table: string,
  privilege: string
) {
  const priv = privilege.toUpperCase() as TablePrivilege
  if (!VALID_TABLE_PRIVILEGES.includes(priv)) {
    throw new Error(`Invalid table privilege: ${privilege}`)
  }
  const safeUser = username.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeSchema = schema.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeTable = table.replace(/[^a-zA-Z0-9_]/g, "_")
  await pool.query(`GRANT ${priv} ON TABLE "${safeSchema}"."${safeTable}" TO "${safeUser}"`)
}

export async function revokeTablePrivilege(
  pool: Pool,
  username: string,
  schema: string,
  table: string,
  privilege: string
) {
  const priv = privilege.toUpperCase() as TablePrivilege
  if (!VALID_TABLE_PRIVILEGES.includes(priv)) {
    throw new Error(`Invalid table privilege: ${privilege}`)
  }
  const safeUser = username.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeSchema = schema.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeTable = table.replace(/[^a-zA-Z0-9_]/g, "_")
  await pool.query(`REVOKE ${priv} ON TABLE "${safeSchema}"."${safeTable}" FROM "${safeUser}"`)
}

export async function transferTableOwnership(
  pool: Pool,
  schema: string,
  table: string,
  newOwner: string
) {
  const safeSchema = schema.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeTable = table.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeOwner = newOwner.replace(/[^a-zA-Z0-9_]/g, "_")
  await pool.query(`ALTER TABLE "${safeSchema}"."${safeTable}" OWNER TO "${safeOwner}"`)
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
