import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPool } from "@/lib/api/get-pg-pool"
import {
  getDatabasePrivileges,
  grantDatabasePrivilege,
  revokeDatabasePrivilege,
  updateConnectionLimit,
} from "@/lib/pg/queries"

export async function GET(
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
    const privileges = await getDatabasePrivileges(pool, dbName)
    return NextResponse.json(privileges)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const { name } = await params
    const dbName = decodeURIComponent(name)
    const body = await request.json()

    const { username, privilege, action, connectionLimit } = body

    if (connectionLimit !== undefined && username) {
      await updateConnectionLimit(pool, username, connectionLimit)
    }

    if (username && privilege && action) {
      if (action === "grant") {
        await grantDatabasePrivilege(pool, username, dbName, privilege)
      } else if (action === "revoke") {
        await revokeDatabasePrivilege(pool, username, dbName, privilege)
      } else {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
