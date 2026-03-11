import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPool } from "@/lib/api/get-pg-pool"
import { dropPgUser, updatePgUser, grantAccess, revokeAccess } from "@/lib/pg/queries"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const { username } = await params
    await dropPgUser(pool, decodeURIComponent(username))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  try {
    const { username } = await params
    const decodedUsername = decodeURIComponent(username)
    const body = await request.json()

    // Handle role attribute updates
    if (body.canLogin !== undefined || body.superuser !== undefined || body.password) {
      await updatePgUser(pool, decodedUsername, {
        canLogin: body.canLogin,
        superuser: body.superuser,
        password: body.password,
      })
    }

    // Handle grant/revoke access
    if (body.grantDatabase) {
      await grantAccess(pool, decodedUsername, body.grantDatabase)
    }
    if (body.revokeDatabase) {
      await revokeAccess(pool, decodedUsername, body.revokeDatabase)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
