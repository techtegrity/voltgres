import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPoolForDb } from "@/lib/api/get-pg-pool"
import { listTables } from "@/lib/pg/queries"

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbName = request.nextUrl.searchParams.get("db")
  if (!dbName) return NextResponse.json({ error: "db query parameter is required" }, { status: 400 })

  const pool = await getUserPoolForDb(session.user.id, dbName)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const tables = await listTables(pool)
    return NextResponse.json(tables)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
