import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { connectionSnapshot } from "@/lib/db/schema"
import { gte, sql } from "drizzle-orm"

/**
 * Returns peak (max) connection counts per database over the last 24 hours.
 * { [database]: { peak: number, peakActive: number, peakAt: string } }
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

  const result: Record<string, { peak: number; peakActive: number }> = {}
  for (const row of rows) {
    result[row.database] = { peak: row.peak, peakActive: row.peakActive }
  }

  return NextResponse.json(result)
}
