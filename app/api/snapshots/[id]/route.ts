import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { snapshot } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { deleteSnapshotObject } from "@/lib/storage/s3"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const [snap] = await db
    .select()
    .from(snapshot)
    .where(and(eq(snapshot.id, id), eq(snapshot.userId, session.user.id)))

  if (!snap) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 })
  }

  return NextResponse.json(snap)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const [snap] = await db
    .select()
    .from(snapshot)
    .where(and(eq(snapshot.id, id), eq(snapshot.userId, session.user.id)))

  if (!snap) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 })
  }

  // Delete from S3/R2 if it was uploaded
  if (snap.storageKey) {
    try {
      await deleteSnapshotObject(snap.storageKey)
    } catch (err) {
      console.error(`[snapshot] Failed to delete from storage: ${snap.storageKey}`, err)
    }
  }

  // Delete from SQLite
  await db.delete(snapshot).where(eq(snapshot.id, id))

  return NextResponse.json({ success: true })
}
