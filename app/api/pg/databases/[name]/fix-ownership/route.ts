import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPool, getUserPoolForDb } from "@/lib/api/get-pg-pool"
import { regrantDatabaseSchemas } from "@/lib/pg/queries"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await params
  const dbName = decodeURIComponent(name)

  const dbPool = await getUserPoolForDb(session.user.id, dbName)
  if (!dbPool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    // Count tables owned by postgres (superuser) in non-system schemas
    const result = await dbPool.query(`
      SELECT count(*)::int AS count
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND tableowner = 'postgres'
    `)
    return NextResponse.json({ misconfiguredCount: result.rows[0]?.count ?? 0 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const { name } = await params
    const dbName = decodeURIComponent(name)
    await regrantDatabaseSchemas(pool, dbName)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
