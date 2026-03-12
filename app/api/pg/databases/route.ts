import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPool } from "@/lib/api/get-pg-pool"
import { listDatabases, createDatabase, lockdownPublicConnect } from "@/lib/pg/queries"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    // Ensure no database leaks CONNECT via the public role.
    // Idempotent — safe to call on every request.
    await lockdownPublicConnect(pool)

    const databases = await listDatabases(pool)
    return NextResponse.json(databases)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const { name, owner, encoding } = await request.json()
    if (!name) return NextResponse.json({ error: "Database name is required" }, { status: 400 })

    await createDatabase(pool, name, owner || "postgres", encoding || "UTF8")
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
