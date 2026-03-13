import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPoolForDb } from "@/lib/api/get-pg-pool"
import {
  getTablePrivileges,
  grantTablePrivilege,
  revokeTablePrivilege,
  transferTableOwnership,
} from "@/lib/pg/queries"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await params
  const dbName = decodeURIComponent(name)

  const pool = await getUserPoolForDb(session.user.id, dbName)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const rows = await getTablePrivileges(pool)
    return NextResponse.json(rows)
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

  const { name } = await params
  const dbName = decodeURIComponent(name)

  const pool = await getUserPoolForDb(session.user.id, dbName)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const body = await request.json()
    const { username, schema, table, privilege, action } = body

    if (!username || !schema || !table || !action) {
      return NextResponse.json(
        { error: "username, schema, table, and action are required" },
        { status: 400 }
      )
    }

    if (action === "transfer_ownership") {
      await transferTableOwnership(pool, schema, table, username)
    } else if (action === "grant") {
      if (!privilege) {
        return NextResponse.json({ error: "privilege is required for grant" }, { status: 400 })
      }
      await grantTablePrivilege(pool, username, schema, table, privilege)
    } else if (action === "revoke") {
      if (!privilege) {
        return NextResponse.json({ error: "privilege is required for revoke" }, { status: 400 })
      }
      await revokeTablePrivilege(pool, username, schema, table, privilege)
    } else {
      return NextResponse.json({ error: "action must be grant, revoke, or transfer_ownership" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
