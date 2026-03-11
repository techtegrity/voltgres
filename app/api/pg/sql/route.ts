import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPoolForDb } from "@/lib/api/get-pg-pool"
import { executeSQL } from "@/lib/pg/queries"

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { db: dbName, query } = await request.json()
    if (!dbName || !query) {
      return NextResponse.json(
        { error: "db and query are required" },
        { status: 400 }
      )
    }

    const pool = await getUserPoolForDb(session.user.id, dbName)
    if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

    const result = await executeSQL(pool, query)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
