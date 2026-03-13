import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPoolForDb } from "@/lib/api/get-pg-pool"
import { executeSQL } from "@/lib/pg/queries"
import { logQuery } from "@/lib/db/query-log"

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

    try {
      const result = await executeSQL(pool, query)

      logQuery({
        userId: session.user.id,
        database: dbName,
        query,
        command: result.command,
        rowCount: result.rowCount,
        executionTime: result.executionTime,
        columns: result.columns,
        resultRows: result.rows,
        source: "sql-editor",
      }).catch(() => {})

      return NextResponse.json(result)
    } catch (error) {
      logQuery({
        userId: session.user.id,
        database: dbName,
        query,
        command: "ERROR",
        error: (error as Error).message,
        source: "sql-editor",
      }).catch(() => {})

      throw error
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
