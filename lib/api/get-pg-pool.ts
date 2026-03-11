import { db } from "@/lib/db"
import { connectionConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getPool, type PgConnectionConfig } from "@/lib/pg/connection"
import { Pool } from "pg"

export async function getUserPool(userId: string): Promise<Pool | null> {
  const configs = await db
    .select()
    .from(connectionConfig)
    .where(eq(connectionConfig.userId, userId))
    .limit(1)

  const config = configs[0]
  if (!config) return null

  const pgConfig: PgConnectionConfig = {
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password || "",
    ssl: config.sslMode === "require",
  }

  return getPool(config.id, pgConfig)
}

export async function getUserPoolForDb(
  userId: string,
  dbName: string
): Promise<Pool | null> {
  const configs = await db
    .select()
    .from(connectionConfig)
    .where(eq(connectionConfig.userId, userId))
    .limit(1)

  const config = configs[0]
  if (!config) return null

  const pgConfig: PgConnectionConfig = {
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password || "",
    database: dbName,
    ssl: config.sslMode === "require",
  }

  return getPool(config.id, pgConfig)
}
