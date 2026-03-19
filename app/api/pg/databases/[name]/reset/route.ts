import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPoolForDb } from "@/lib/api/get-pg-pool"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name: dbName } = await params

  const pool = await getUserPoolForDb(session.user.id, dbName)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  const client = await pool.connect()
  try {
    // Get all non-system schemas to drop
    const { rows: schemas } = await client.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')`
    )

    for (const { schema_name } of schemas) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema_name.replace(/"/g, '""')}" CASCADE`)
    }

    // Recreate public schema
    await client.query(`CREATE SCHEMA public`)
    await client.query(`GRANT ALL ON SCHEMA public TO PUBLIC`)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  } finally {
    client.release()
  }
}
