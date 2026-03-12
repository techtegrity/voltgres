import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { snapshot, storageConfig } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { executeSnapshot } from "@/lib/snapshots/execute"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dbFilter = request.nextUrl.searchParams.get("db")

  let query = db
    .select()
    .from(snapshot)
    .where(eq(snapshot.userId, session.user.id))
    .orderBy(desc(snapshot.createdAt))

  const results = await query

  const filtered = dbFilter
    ? results.filter((s) => s.database === dbFilter)
    : results

  return NextResponse.json(filtered)
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { database } = body

  if (!database) {
    return NextResponse.json(
      { error: "Database name is required" },
      { status: 400 }
    )
  }

  // Check storage is configured
  const storage = await db.select().from(storageConfig).limit(1)
  if (storage.length === 0) {
    return NextResponse.json(
      { error: "Storage not configured. Go to Settings to configure S3 or R2." },
      { status: 400 }
    )
  }

  const id = crypto.randomUUID()
  const now = new Date()

  await db.insert(snapshot).values({
    id,
    database,
    status: "pending",
    trigger: "manual",
    createdAt: now,
    userId: session.user.id,
  })

  // Fire and forget — don't await
  executeSnapshot(id).catch((err) => {
    console.error(`[snapshot] Async execution failed for ${id}:`, err)
  })

  return NextResponse.json({ id, status: "pending" })
}
