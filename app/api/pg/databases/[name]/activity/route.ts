import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPool } from "@/lib/api/get-pg-pool"
import { listDatabaseActivity, terminateBackend } from "@/lib/pg/queries"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  const { name } = await params
  const dbName = decodeURIComponent(name)

  try {
    const activity = await listDatabaseActivity(pool, dbName)
    return NextResponse.json(activity)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool) return NextResponse.json({ error: "No connection configured" }, { status: 400 })

  // params needed for route matching even though we don't use name for terminate
  await params

  const body = await req.json()
  const pid = body.pid
  if (typeof pid !== "number") {
    return NextResponse.json({ error: "pid is required" }, { status: 400 })
  }

  try {
    const terminated = await terminateBackend(pool, pid)
    return NextResponse.json({ terminated })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
