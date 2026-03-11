import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPool } from "@/lib/api/get-pg-pool"
import { listPgUsers, createPgUser } from "@/lib/pg/queries"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const users = await listPgUsers(pool)
    return NextResponse.json(users)
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
    const { username, password, superuser, canLogin } = await request.json()
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    await createPgUser(pool, username, password, { superuser, canLogin })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
