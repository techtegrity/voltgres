import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { snapshot } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { executeRestore } from "@/lib/snapshots/restore"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { targetDatabase } = body

  const [snap] = await db
    .select()
    .from(snapshot)
    .where(and(eq(snapshot.id, id), eq(snapshot.userId, session.user.id)))

  if (!snap) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 })
  }

  if (snap.status !== "completed" || !snap.storageKey) {
    return NextResponse.json(
      { error: "Snapshot is not available for restore" },
      { status: 400 }
    )
  }

  // Fire and forget
  executeRestore(id, targetDatabase).catch((err) => {
    console.error(`[restore] Failed for snapshot ${id}:`, err)
  })

  return NextResponse.json({
    success: true,
    message: `Restoring snapshot to database "${targetDatabase || snap.database}"`,
  })
}
