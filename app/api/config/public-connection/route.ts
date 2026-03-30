import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({
    publicHost: process.env.DOMAIN || null,
    publicPort: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    pgBouncerPort: parseInt(process.env.PGBOUNCER_PORT || "6432", 10),
  })
}
