import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { connectionSnapshot } from "@/lib/db/schema"
import { eq, gte, and, desc } from "drizzle-orm"

type Range = "1h" | "1d" | "1w"

const RANGE_CONFIG: Record<Range, { ms: number; bucketMs: number }> = {
  "1h": { ms: 60 * 60 * 1000, bucketMs: 0 },            // raw, ~60 points
  "1d": { ms: 24 * 60 * 60 * 1000, bucketMs: 5 * 60000 }, // 5-min buckets
  "1w": { ms: 7 * 24 * 60 * 60 * 1000, bucketMs: 30 * 60000 }, // 30-min buckets
}

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const database = req.nextUrl.searchParams.get("database")
  if (!database) return NextResponse.json({ error: "database param required" }, { status: 400 })

  const range = (req.nextUrl.searchParams.get("range") || "1h") as Range
  const config = RANGE_CONFIG[range]
  if (!config) return NextResponse.json({ error: "Invalid range" }, { status: 400 })

  const since = new Date(Date.now() - config.ms)

  const rows = await db
    .select()
    .from(connectionSnapshot)
    .where(
      and(
        eq(connectionSnapshot.database, database),
        gte(connectionSnapshot.sampledAt, since)
      )
    )
    .orderBy(connectionSnapshot.sampledAt)

  // If no bucketing needed, return raw
  if (config.bucketMs === 0) {
    return NextResponse.json(
      rows.map((r) => ({
        time: r.sampledAt.toISOString(),
        total: r.total,
        active: r.active,
        idle: r.idle,
      }))
    )
  }

  // Downsample into time buckets
  const buckets = new Map<number, { total: number; active: number; idle: number; count: number }>()
  for (const row of rows) {
    const ts = row.sampledAt.getTime()
    const bucketKey = Math.floor(ts / config.bucketMs) * config.bucketMs
    const existing = buckets.get(bucketKey)
    if (existing) {
      existing.total += row.total
      existing.active += row.active
      existing.idle += row.idle
      existing.count++
    } else {
      buckets.set(bucketKey, { total: row.total, active: row.active, idle: row.idle, count: 1 })
    }
  }

  const result = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, b]) => ({
      time: new Date(ts).toISOString(),
      total: Math.round(b.total / b.count),
      active: Math.round(b.active / b.count),
      idle: Math.round(b.idle / b.count),
    }))

  return NextResponse.json(result)
}
