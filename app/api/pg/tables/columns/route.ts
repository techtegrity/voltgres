import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPoolForDb } from "@/lib/api/get-pg-pool"
import { getTableColumns } from "@/lib/pg/queries"

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbName = request.nextUrl.searchParams.get("db")
  const schema = request.nextUrl.searchParams.get("schema") || "public"
  const table = request.nextUrl.searchParams.get("table")

  if (!dbName || !table) {
    return NextResponse.json(
      { error: "db and table query parameters are required" },
      { status: 400 }
    )
  }

  const pool = await getUserPoolForDb(session.user.id, dbName)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const columns = await getTableColumns(pool, schema, table)
    return NextResponse.json(columns)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
