import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { user, connectionConfig } from "@/lib/db/schema"
import { auth } from "@/lib/auth"
import { count, eq } from "drizzle-orm"
import { getPool, type PgConnectionConfig } from "@/lib/pg/connection"
import { lockdownPublicConnect } from "@/lib/pg/queries"
import { encrypt } from "@/lib/crypto"

export async function GET() {
  const [result] = await db.select({ count: count() }).from(user)
  return NextResponse.json({ needsSetup: result.count === 0 })
}

export async function POST(req: NextRequest) {
  // Only allow setup if no users exist
  const [result] = await db.select({ count: count() }).from(user)
  if (result.count > 0) {
    return NextResponse.json(
      { error: "Setup already completed" },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { name, email, password } = body

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required" },
      { status: 400 }
    )
  }

  if (password.length < 10) {
    return NextResponse.json(
      { error: "Password must be at least 10 characters" },
      { status: 400 }
    )
  }

  try {
    await auth.api.signUpEmail({
      body: { name, email, password },
    })

    // Auto-configure PostgreSQL connection from env vars (Docker Compose)
    const pgHost = process.env.POSTGRES_HOST
    const pgPassword = process.env.POSTGRES_PASSWORD
    if (pgHost && pgPassword) {
      const [newUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1)

      if (newUser) {
        const configId = crypto.randomUUID()
        const pgPort = parseInt(process.env.POSTGRES_PORT || "5432", 10)
        const pgUser = process.env.POSTGRES_USER || "postgres"
        const now = new Date()
        await db.insert(connectionConfig).values({
          id: configId,
          host: pgHost,
          port: pgPort,
          username: pgUser,
          password: encrypt(pgPassword),
          sslMode: "disable",
          createdAt: now,
          updatedAt: now,
          userId: newUser.id,
        })

        // Lock down existing databases so only explicitly granted users can connect
        const pgConfig: PgConnectionConfig = {
          host: pgHost,
          port: pgPort,
          user: pgUser,
          password: pgPassword,
          ssl: false,
        }
        const pool = getPool(configId, pgConfig)
        await lockdownPublicConnect(pool)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create admin account"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
