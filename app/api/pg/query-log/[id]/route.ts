import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getQueryLogById } from "@/lib/db/query-log"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const entry = getQueryLogById(id)
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(entry)
}
