import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { backupConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { reloadSchedule } from "@/lib/snapshots/scheduler"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const configs = await db
    .select()
    .from(backupConfig)
    .where(eq(backupConfig.userId, session.user.id))

  return NextResponse.json(
    configs.map((c) => ({
      ...c,
      databases: JSON.parse(c.databases),
    }))
  )
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const {
      name, type, schedule, enabled, databases, destination,
      pruningEnabled, retentionKeepLast, retentionThinKeepEvery,
    } = await request.json()

    if (!name || !schedule) {
      return NextResponse.json(
        { error: "name and schedule are required" },
        { status: 400 }
      )
    }

    const now = new Date()
    const id = crypto.randomUUID()

    await db.insert(backupConfig).values({
      id,
      name,
      type: type || "s3",
      schedule,
      enabled: enabled !== false,
      databases: JSON.stringify(databases || []),
      destination: destination || "",
      pruningEnabled: pruningEnabled !== false,
      retentionKeepLast: retentionKeepLast ?? 7,
      retentionThinKeepEvery: retentionThinKeepEvery ?? 30,
      createdAt: now,
      updatedAt: now,
      userId: session.user.id,
    })

    // Reload scheduler for this new config
    reloadSchedule(id).catch((err) => {
      console.error("[backups] Failed to reload schedule:", err)
    })

    return NextResponse.json({ id, success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
