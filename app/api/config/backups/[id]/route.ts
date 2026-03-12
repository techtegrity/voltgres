import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { backupConfig } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { reloadSchedule } from "@/lib/snapshots/scheduler"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.name !== undefined) updates.name = body.name
    if (body.type !== undefined) updates.type = body.type
    if (body.schedule !== undefined) updates.schedule = body.schedule
    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.databases !== undefined)
      updates.databases = JSON.stringify(body.databases)
    if (body.destination !== undefined) updates.destination = body.destination
    if (body.lastRun !== undefined) updates.lastRun = new Date(body.lastRun)

    await db
      .update(backupConfig)
      .set(updates)
      .where(
        and(eq(backupConfig.id, id), eq(backupConfig.userId, session.user.id))
      )

    reloadSchedule(id).catch((err) => {
      console.error("[backups] Failed to reload schedule:", err)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    await db
      .delete(backupConfig)
      .where(
        and(eq(backupConfig.id, id), eq(backupConfig.userId, session.user.id))
      )

    reloadSchedule(id).catch((err) => {
      console.error("[backups] Failed to reload schedule:", err)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
