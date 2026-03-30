import cron from "node-cron"
import { db } from "@/lib/db"
import { alert, connectionConfig, connectionSnapshot } from "@/lib/db/schema"
import { eq, and, lt } from "drizzle-orm"
import { getPool, type PgConnectionConfig } from "@/lib/pg/connection"
import { getConnectionsByRole, getServerInfo } from "@/lib/pg/queries"
import { decrypt } from "@/lib/crypto"

const WARNING_THRESHOLD = 0.8
const CRITICAL_THRESHOLD = 0.9

let task: cron.ScheduledTask | null = null

async function getMonitorPool() {
  // Use the first available connection config (admin connection)
  const configs = await db.select().from(connectionConfig).limit(1)
  const config = configs[0]
  if (!config) return null

  const pgConfig: PgConnectionConfig = {
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password ? decrypt(config.password) : "",
    ssl: config.sslMode === "require",
  }

  return getPool(`monitor:${config.id}`, pgConfig)
}

async function findOrCreateAlert(
  type: string,
  roleName: string | null,
  message: string,
  currentValue: number,
  threshold: number
) {
  // Check for an existing unresolved alert of the same type+role
  const existing = await db
    .select()
    .from(alert)
    .where(
      and(
        eq(alert.type, type as any),
        eq(alert.resolved, false),
        ...(roleName ? [eq(alert.roleName, roleName)] : [])
      )
    )
    .limit(1)

  if (existing.length > 0) {
    // Update the existing alert with current values
    await db
      .update(alert)
      .set({ currentValue, message })
      .where(eq(alert.id, existing[0].id))
    return
  }

  // Create new alert
  await db.insert(alert).values({
    id: crypto.randomUUID(),
    type: type as any,
    roleName,
    message,
    currentValue,
    threshold,
    createdAt: new Date(),
  })

  console.log(`[monitor] ALERT: ${message}`)
}

async function resolveAlerts(type: string, roleName?: string) {
  const conditions = [eq(alert.type, type as any), eq(alert.resolved, false)]
  if (roleName) conditions.push(eq(alert.roleName, roleName))

  await db
    .update(alert)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(and(...conditions))
}

async function checkConnections() {
  try {
    const pool = await getMonitorPool()
    if (!pool) return

    const [roles, serverInfo] = await Promise.all([
      getConnectionsByRole(pool),
      getServerInfo(pool),
    ])

    // Check per-role connection usage
    for (const role of roles) {
      const limit = role.connection_limit
      const active = role.active_connections

      if (limit <= 0) continue // -1 = unlimited, skip

      const usage = active / limit

      if (usage >= CRITICAL_THRESHOLD) {
        await findOrCreateAlert(
          "connection_limit_critical",
          role.rolename,
          `Role "${role.rolename}" is at ${active}/${limit} connections (${Math.round(usage * 100)}%)`,
          active,
          limit
        )
      } else if (usage >= WARNING_THRESHOLD) {
        // Resolve any critical alert if we dropped back to warning level
        await resolveAlerts("connection_limit_critical", role.rolename)
        await findOrCreateAlert(
          "connection_limit_warning",
          role.rolename,
          `Role "${role.rolename}" is at ${active}/${limit} connections (${Math.round(usage * 100)}%)`,
          active,
          limit
        )
      } else {
        // Usage is healthy — resolve any existing alerts for this role
        await resolveAlerts("connection_limit_warning", role.rolename)
        await resolveAlerts("connection_limit_critical", role.rolename)
      }
    }

    // Check total server connection usage
    const { maxConnections, activeConnections } = serverInfo
    const serverUsage = activeConnections / maxConnections

    if (serverUsage >= CRITICAL_THRESHOLD) {
      await findOrCreateAlert(
        "server_connections_critical",
        null,
        `Server at ${activeConnections}/${maxConnections} connections (${Math.round(serverUsage * 100)}%)`,
        activeConnections,
        maxConnections
      )
    } else if (serverUsage >= WARNING_THRESHOLD) {
      await resolveAlerts("server_connections_critical")
      await findOrCreateAlert(
        "server_connections_warning",
        null,
        `Server at ${activeConnections}/${maxConnections} connections (${Math.round(serverUsage * 100)}%)`,
        activeConnections,
        maxConnections
      )
    } else {
      await resolveAlerts("server_connections_warning")
      await resolveAlerts("server_connections_critical")
    }
    // Record per-database connection snapshots
    try {
      const snapRows = await pool.query(`
        SELECT
          datname AS database,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE state = 'active')::int AS active,
          COUNT(*) FILTER (WHERE state != 'active')::int AS idle
        FROM pg_stat_activity
        WHERE datname IS NOT NULL
          AND backend_type = 'client backend'
        GROUP BY datname
      `)
      const now = new Date()
      for (const row of snapRows.rows) {
        await db.insert(connectionSnapshot).values({
          id: crypto.randomUUID(),
          database: row.database,
          total: row.total,
          active: row.active,
          idle: row.idle,
          sampledAt: now,
        })
      }

      // Cleanup: delete snapshots older than 8 days
      const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      await db.delete(connectionSnapshot).where(lt(connectionSnapshot.sampledAt, cutoff))
    } catch (snapError) {
      console.error("[monitor] Snapshot recording failed:", (snapError as Error).message)
    }
  } catch (error) {
    console.error("[monitor] Connection check failed:", (error as Error).message)
  }
}

export function initConnectionMonitor() {
  console.log("[monitor] Starting connection monitor (60s interval)")
  task = cron.schedule("* * * * *", checkConnections)

  // Run initial check after a short delay
  setTimeout(checkConnections, 5000)
}

export function stopConnectionMonitor() {
  if (task) {
    task.stop()
    task = null
    console.log("[monitor] Stopped connection monitor")
  }
}
