import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { accessRule } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { invalidateAccessRuleCache } from "@/lib/access-control"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  try {
    const body = await request.json()
    const updates: Record<string, unknown> = { updatedAt: new Date() }

    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.description !== undefined) updates.description = body.description
    if (body.value !== undefined) updates.value = body.value

    await db.update(accessRule).set(updates).where(eq(accessRule.id, id))
    invalidateAccessRuleCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  await db.delete(accessRule).where(eq(accessRule.id, id))
  invalidateAccessRuleCache()

  return NextResponse.json({ success: true })
}
