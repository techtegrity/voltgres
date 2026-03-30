import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { alert } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const resolved = request.nextUrl.searchParams.get("resolved") === "true"

  const alerts = await db
    .select()
    .from(alert)
    .where(eq(alert.resolved, resolved))
    .orderBy(desc(alert.createdAt))
    .limit(50)

  return NextResponse.json(alerts)
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: "Alert ID required" }, { status: 400 })

  await db
    .update(alert)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(and(eq(alert.id, id), eq(alert.resolved, false)))

  return NextResponse.json({ success: true })
}
