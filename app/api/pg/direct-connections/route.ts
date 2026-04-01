import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPool } from "@/lib/api/get-pg-pool"
import { getDatabasesWithDirectConnections } from "@/lib/pg/queries"

/**
 * Returns databases that have direct external connections (not through
 * PgBouncer or Docker internal network). Used to show migration status
 * on the dashboard.
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const rows = await getDatabasesWithDirectConnections(pool)
    const databases: Record<string, number> = {}
    for (const row of rows) {
      databases[row.datname] = row.direct_connections
    }
    return NextResponse.json({ databases })
  } catch {
    return NextResponse.json({ databases: {} })
  }
}
