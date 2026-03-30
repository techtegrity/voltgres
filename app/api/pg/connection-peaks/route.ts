import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPool } from "@/lib/api/get-pg-pool"
import { getServerInfo } from "@/lib/pg/queries"
import { db } from "@/lib/db"
import { connectionSnapshot } from "@/lib/db/schema"
import { gte, sql } from "drizzle-orm"

/**
 * Returns peak (max) connection counts per database over the last 24 hours,
 * plus the server's max_connections setting.
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      database: connectionSnapshot.database,
      peak: sql<number>`MAX(${connectionSnapshot.total})`,
      peakActive: sql<number>`MAX(${connectionSnapshot.active})`,
    })
    .from(connectionSnapshot)
    .where(gte(connectionSnapshot.sampledAt, since))
    .groupBy(connectionSnapshot.database)

  const databases: Record<string, { peak: number; peakActive: number }> = {}
  for (const row of rows) {
    databases[row.database] = { peak: row.peak, peakActive: row.peakActive }
  }

  let maxConnections: number | null = null
  try {
    const pool = await getUserPool(session.user.id)
    if (pool) {
      const info = await getServerInfo(pool)
      maxConnections = info.maxConnections
    }
  } catch {
    // non-critical
  }

  return NextResponse.json({ databases, maxConnections })
}
