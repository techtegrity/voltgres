import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPool } from "@/lib/api/get-pg-pool"
import {
  checkPgStatStatements,
  enablePgStatStatements,
  getPgStatStatements,
  resetPgStatStatements,
} from "@/lib/pg/queries"

/**
 * GET /api/pg/stat-statements
 * Fetch pg_stat_statements data.
 * Query params: db (filter by database), search, limit
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool)
    return NextResponse.json(
      { error: "No connection configured" },
      { status: 400 }
    )

  try {
    const { preloaded, installed } = await checkPgStatStatements(pool)

    if (!preloaded) {
      return NextResponse.json({
        available: false,
        reason: "not_preloaded",
        entries: [],
      })
    }

    // Try to auto-install if preloaded but not yet installed
    let isInstalled = installed
    if (!isInstalled) {
      isInstalled = await enablePgStatStatements(pool)
    }

    if (!isInstalled) {
      return NextResponse.json({
        available: false,
        reason: "install_failed",
        entries: [],
      })
    }

    const searchParams = request.nextUrl.searchParams
    const database = searchParams.get("db") || undefined
    const search = searchParams.get("search") || undefined
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100", 10),
      500
    )

    const entries = await getPgStatStatements(pool, {
      database,
      search,
      limit,
    })
    return NextResponse.json({ available: true, entries })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/pg/stat-statements
 * Actions: "enable" to install extension, "reset" to clear counters.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pool = await getUserPool(session.user.id)
  if (!pool)
    return NextResponse.json(
      { error: "No connection configured" },
      { status: 400 }
    )

  try {
    const { action } = await request.json()

    if (action === "enable") {
      const success = await enablePgStatStatements(pool)
      if (!success) {
        return NextResponse.json(
          {
            error:
              "Could not enable pg_stat_statements. Ensure it is listed in shared_preload_libraries.",
          },
          { status: 400 }
        )
      }
      return NextResponse.json({ success: true })
    }

    if (action === "reset") {
      await resetPgStatStatements(pool)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'enable' or 'reset'." },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
