import { Pool, type PoolConfig } from "pg"

const pools = new Map<string, Pool>()

export interface PgConnectionConfig {
  host: string
  port: number
  user: string
  password: string
  database?: string
  ssl?: boolean
}

export function getPool(configId: string, config: PgConnectionConfig): Pool {
  const key = config.database ? `${configId}:${config.database}` : configId
  const existing = pools.get(key)
  if (existing) return existing

  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database || "postgres",
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  }

  const pool = new Pool(poolConfig)
  pools.set(key, pool)
  return pool
}

export async function closePool(configId: string): Promise<void> {
  for (const [key, pool] of pools.entries()) {
    if (key === configId || key.startsWith(`${configId}:`)) {
      await pool.end()
      pools.delete(key)
    }
  }
}

export async function testConnection(
  config: PgConnectionConfig
): Promise<{ success: boolean; version?: string; error?: string }> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database || "postgres",
    max: 1,
    connectionTimeoutMillis: 5000,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  })

  try {
    const result = await pool.query("SELECT version()")
    return { success: true, version: result.rows[0].version }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  } finally {
    await pool.end()
  }
}
