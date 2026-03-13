import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getQueryLogs } from "@/lib/db/query-log"

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = request.nextUrl.searchParams
  const database = params.get("db") || undefined
  const search = params.get("search") || undefined
  const page = parseInt(params.get("page") || "1", 10)
  const pageSize = Math.min(parseInt(params.get("pageSize") || "50", 10), 200)

  const result = getQueryLogs({ database, search, page, pageSize })

  // Strip resultPreview from list response to keep payloads small
  const entries = result.entries.map(({ resultPreview, ...rest }) => rest)

  return NextResponse.json({
    entries,
    totalCount: result.totalCount,
    page: result.page,
    pageSize: result.pageSize,
  })
}
