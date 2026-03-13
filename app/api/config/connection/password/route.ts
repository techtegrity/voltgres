import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { connectionConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { decrypt } from "@/lib/crypto"

/**
 * Reveal the decrypted admin PostgreSQL password.
 * Requires authentication. Used by the connection modal
 * when building connection strings.
 */
export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const configs = await db
    .select()
    .from(connectionConfig)
    .where(eq(connectionConfig.userId, session.user.id))
    .limit(1)

  const config = configs[0]
  if (!config?.password) {
    return NextResponse.json({ password: "" })
  }

  const password = decrypt(config.password)
  return NextResponse.json({ password })
}
