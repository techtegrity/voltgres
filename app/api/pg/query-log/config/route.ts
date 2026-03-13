import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getQueryLogConfig, upsertQueryLogConfig } from "@/lib/db/query-log"

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = request.nextUrl.searchParams.get("db")
  if (!db) return NextResponse.json({ error: "db parameter required" }, { status: 400 })

  const config = getQueryLogConfig(db)
  return NextResponse.json(config ?? { database: db, enabled: true, retentionDays: 7 })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { database, enabled, retentionDays } = await request.json()
  if (!database) return NextResponse.json({ error: "database is required" }, { status: 400 })

  if (retentionDays !== undefined && ![1, 7, 30].includes(retentionDays)) {
    return NextResponse.json({ error: "retentionDays must be 1, 7, or 30" }, { status: 400 })
  }

  upsertQueryLogConfig(database, { enabled, retentionDays })
  const updated = getQueryLogConfig(database)
  return NextResponse.json(updated ?? { database, enabled: enabled ?? true, retentionDays: retentionDays ?? 7 })
}
