import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getQueryLogStats } from "@/lib/db/query-log"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const stats = getQueryLogStats()
  return NextResponse.json(stats)
}
