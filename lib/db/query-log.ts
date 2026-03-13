import { db } from "./index"
import { queryLog, queryLogConfig } from "./schema"
import { eq, desc, and, like, sql, lt } from "drizzle-orm"
import { randomUUID } from "crypto"

// ── Throttled cleanup ────────────────────────────────────────────────
let lastPurge = 0
const PURGE_INTERVAL_MS = 60_000 // once per minute

async function maybePurge() {
  const now = Date.now()
  if (now - lastPurge < PURGE_INTERVAL_MS) return
  lastPurge = now
  try {
    await purgeExpiredLogs()
  } catch {
    // swallow — cleanup is best-effort
  }
}

// ── Log a query ──────────────────────────────────────────────────────

export interface LogQueryInput {
  userId: string
  database: string
  query: string
  command: string
  rowCount?: number
  executionTime?: number
  columns?: string[]
  resultRows?: Record<string, unknown>[]
  error?: string
  source: string
}

export async function logQuery(input: LogQueryInput) {
  // Check if logging is enabled for this database
  const config = await getQueryLogConfig(input.database)
  if (config && !config.enabled) return

  const preview =
    input.resultRows && input.resultRows.length > 0
      ? JSON.stringify(input.resultRows.slice(0, 20))
      : null

  db.insert(queryLog)
    .values({
      id: randomUUID(),
      userId: input.userId,
      database: input.database,
      query: input.query,
      command: input.command,
      rowCount: input.rowCount ?? null,
      executionTime: input.executionTime ?? null,
      columns: input.columns ? JSON.stringify(input.columns) : null,
      resultPreview: preview,
      error: input.error ?? null,
      source: input.source,
      createdAt: new Date(),
    })
    .run()

  // Trigger background cleanup
  maybePurge()
}

// ── Query logs ───────────────────────────────────────────────────────

export interface QueryLogEntry {
  id: string
  userId: string
  database: string
  query: string
  command: string
  rowCount: number | null
  executionTime: number | null
  columns: string[] | null
  resultPreview: Record<string, unknown>[] | null
  error: string | null
  source: string
  createdAt: Date
}

function parseEntry(row: typeof queryLog.$inferSelect): QueryLogEntry {
  return {
    ...row,
    columns: row.columns ? JSON.parse(row.columns) : null,
    resultPreview: row.resultPreview ? JSON.parse(row.resultPreview) : null,
  }
}

export interface GetQueryLogsOpts {
  database?: string
  search?: string
  page?: number
  pageSize?: number
}

export function getQueryLogs(opts: GetQueryLogsOpts = {}) {
  const { database, search, page = 1, pageSize = 50 } = opts
  const conditions = []

  if (database) {
    conditions.push(eq(queryLog.database, database))
  }
  if (search) {
    conditions.push(like(queryLog.query, `%${search}%`))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = db
    .select()
    .from(queryLog)
    .where(where)
    .orderBy(desc(queryLog.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()

  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(queryLog)
    .where(where)
    .get()

  return {
    entries: rows.map(parseEntry),
    totalCount: countResult?.count ?? 0,
    page,
    pageSize,
  }
}

export function getQueryLogById(id: string): QueryLogEntry | null {
  const row = db.select().from(queryLog).where(eq(queryLog.id, id)).get()
  if (!row) return null
  return parseEntry(row)
}

// ── Stats ────────────────────────────────────────────────────────────

export interface QueryLogStats {
  database: string
  entryCount: number
  estimatedSizeBytes: number
  oldestEntry: Date | null
  newestEntry: Date | null
  retentionDays: number
  enabled: boolean
}

export function getQueryLogStats(): QueryLogStats[] {
  // Get per-database counts and rough size estimates
  const dbStats = db
    .select({
      database: queryLog.database,
      entryCount: sql<number>`count(*)`,
      avgSize: sql<number>`avg(length(coalesce(${queryLog.query}, '')) + length(coalesce(${queryLog.resultPreview}, '')) + length(coalesce(${queryLog.columns}, '')) + 200)`,
      oldestEntry: sql<number>`min(${queryLog.createdAt})`,
      newestEntry: sql<number>`max(${queryLog.createdAt})`,
    })
    .from(queryLog)
    .groupBy(queryLog.database)
    .all()

  // Get configs
  const configs = db.select().from(queryLogConfig).all()
  const configMap = new Map(configs.map((c) => [c.database, c]))

  return dbStats.map((s) => {
    const config = configMap.get(s.database)
    return {
      database: s.database,
      entryCount: s.entryCount,
      estimatedSizeBytes: Math.round(s.entryCount * (s.avgSize || 500)),
      oldestEntry: s.oldestEntry ? new Date(s.oldestEntry as number * 1000) : null,
      newestEntry: s.newestEntry ? new Date(s.newestEntry as number * 1000) : null,
      retentionDays: config?.retentionDays ?? 7,
      enabled: config?.enabled ?? true,
    }
  })
}

// ── Purge expired logs ───────────────────────────────────────────────

export function purgeExpiredLogs() {
  // Get all configs
  const configs = db.select().from(queryLogConfig).all()
  const configMap = new Map(configs.map((c) => [c.database, c]))

  // Get distinct databases in the log
  const databases = db
    .selectDistinct({ database: queryLog.database })
    .from(queryLog)
    .all()

  for (const { database } of databases) {
    const config = configMap.get(database)
    const retentionDays = config?.retentionDays ?? 7
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    db.delete(queryLog)
      .where(and(eq(queryLog.database, database), lt(queryLog.createdAt, cutoff)))
      .run()
  }
}

// ── Per-database config ──────────────────────────────────────────────

export function getQueryLogConfig(database: string) {
  return (
    db
      .select()
      .from(queryLogConfig)
      .where(eq(queryLogConfig.database, database))
      .get() ?? null
  )
}

export function upsertQueryLogConfig(
  database: string,
  config: { enabled?: boolean; retentionDays?: number }
) {
  const existing = getQueryLogConfig(database)
  const now = new Date()

  if (existing) {
    db.update(queryLogConfig)
      .set({
        ...(config.enabled !== undefined ? { enabled: config.enabled } : {}),
        ...(config.retentionDays !== undefined
          ? { retentionDays: config.retentionDays }
          : {}),
        updatedAt: now,
      })
      .where(eq(queryLogConfig.id, existing.id))
      .run()
  } else {
    db.insert(queryLogConfig)
      .values({
        id: randomUUID(),
        database,
        enabled: config.enabled ?? true,
        retentionDays: config.retentionDays ?? 7,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }
}
