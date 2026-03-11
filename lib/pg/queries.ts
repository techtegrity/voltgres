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

export async function grantAccess(
  pool: Pool,
  username: string,
  dbName: string
) {
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeDbName = dbName.replace(/[^a-zA-Z0-9_]/g, "_")
  await pool.query(`GRANT CONNECT ON DATABASE "${safeDbName}" TO "${safeUsername}"`)
}

export async function revokeAccess(
  pool: Pool,
  username: string,
  dbName: string
) {
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_")
  const safeDbName = dbName.replace(/[^a-zA-Z0-9_]/g, "_")
  await pool.query(`REVOKE CONNECT ON DATABASE "${safeDbName}" FROM "${safeUsername}"`)
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
