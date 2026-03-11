import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { connectionConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const configs = await db
    .select()
    .from(connectionConfig)
    .where(eq(connectionConfig.userId, session.user.id))
    .limit(1)

  const config = configs[0]
  if (!config) {
    return NextResponse.json({
      host: "localhost",
      port: 5432,
      username: "postgres",
      password: "",
      sslMode: "prefer",
    })
  }

  return NextResponse.json({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password || "",
    sslMode: config.sslMode,
  })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { host, port, username, password, sslMode } = await request.json()

    const existing = await db
      .select()
      .from(connectionConfig)
      .where(eq(connectionConfig.userId, session.user.id))
      .limit(1)

    const now = new Date()

    if (existing[0]) {
      await db
        .update(connectionConfig)
        .set({
          host: host || "localhost",
          port: parseInt(port, 10) || 5432,
          username: username || "postgres",
          password: password || "",
          sslMode: sslMode || "prefer",
          updatedAt: now,
        })
        .where(eq(connectionConfig.id, existing[0].id))
    } else {
      await db.insert(connectionConfig).values({
        id: crypto.randomUUID(),
        host: host || "localhost",
        port: parseInt(port, 10) || 5432,
        username: username || "postgres",
        password: password || "",
        sslMode: sslMode || "prefer",
        createdAt: now,
        updatedAt: now,
        userId: session.user.id,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
