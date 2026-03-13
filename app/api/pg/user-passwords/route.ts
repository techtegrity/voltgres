import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { pgUserPassword } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { encrypt, decrypt } from "@/lib/crypto"
import { randomUUID } from "node:crypto"

/**
 * GET /api/pg/user-passwords
 * Returns all stored PG user passwords for the current user.
 * Passwords are decrypted before returning.
 */
export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const rows = await db
      .select()
      .from(pgUserPassword)
      .where(eq(pgUserPassword.userId, session.user.id))

    const passwords: Record<string, string> = {}
    for (const row of rows) {
      try {
        passwords[row.pgUsername] = decrypt(row.encryptedPassword)
      } catch {
        // Skip rows with corrupt encrypted data
      }
    }

    return NextResponse.json(passwords)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/pg/user-passwords
 * Store or update a PG user password.
 * Body: { username: string, password: string }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { username, password } = await request.json()
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      )
    }

    const now = new Date()
    const encrypted = encrypt(password)

    // Check if we already have a password for this user
    const existing = await db
      .select()
      .from(pgUserPassword)
      .where(
        and(
          eq(pgUserPassword.userId, session.user.id),
          eq(pgUserPassword.pgUsername, username)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      // Update existing
      await db
        .update(pgUserPassword)
        .set({
          encryptedPassword: encrypted,
          updatedAt: now,
        })
        .where(eq(pgUserPassword.id, existing[0].id))
    } else {
      // Insert new
      await db.insert(pgUserPassword).values({
        id: randomUUID(),
        pgUsername: username,
        encryptedPassword: encrypted,
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
