import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { connectionConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  if (!session) {
    redirect("/login")
  }

  // Auto-configure PostgreSQL connection from env vars if user has none
  // (handles Google OAuth users who bypass /api/setup POST)
  const pgHost = process.env.POSTGRES_HOST
  const pgPassword = process.env.POSTGRES_PASSWORD
  if (pgHost && pgPassword) {
    const existing = await db
      .select({ id: connectionConfig.id })
      .from(connectionConfig)
      .where(eq(connectionConfig.userId, session.user.id))
      .limit(1)

    if (existing.length === 0) {
      const now = new Date()
      await db.insert(connectionConfig).values({
        id: crypto.randomUUID(),
        host: pgHost,
        port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
        username: process.env.POSTGRES_USER || "postgres",
        password: pgPassword,
        sslMode: "disable",
        createdAt: now,
        updatedAt: now,
        userId: session.user.id,
      })
    }
  }

  return children
}
