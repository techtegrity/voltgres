import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import Database from "better-sqlite3"
import path from "path"

const SENSITIVE_COLUMNS = new Set([
  "password",
  "encrypted_password",
  "access_token",
  "refresh_token",
  "id_token",
  "secret",
  "backup_codes",
  "secret_access_key",
  "access_key_id",
  "token",
])

function getDb() {
  const dbPath =
    process.env.VOLTGRES_DB_PATH || path.join(process.cwd(), "voltgres.db")
  const sqlite = new Database(dbPath, { readonly: true })
  return sqlite
}

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const table = searchParams.get("table")
  const page = parseInt(searchParams.get("page") || "1", 10)
  const pageSize = Math.min(
    parseInt(searchParams.get("pageSize") || "50", 10),
    200
  )

  const sqlite = getDb()

  try {
    if (!table) {
      // List all tables with row counts
      const tables = sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name`
        )
        .all() as { name: string }[]

      const result = tables.map((t) => {
        const countRow = sqlite
          .prepare(`SELECT COUNT(*) as count FROM "${t.name}"`)
          .get() as { count: number }
        return { name: t.name, rowCount: countRow.count }
      })

      return NextResponse.json({ tables: result })
    }

    // Validate table name exists
    const tableExists = sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`
      )
      .get(table)
    if (!tableExists) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    // Get columns
    const columns = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as {
      name: string
      type: string
      notnull: number
      pk: number
    }[]

    // Get total count
    const countRow = sqlite
      .prepare(`SELECT COUNT(*) as count FROM "${table}"`)
      .get() as { count: number }

    // Get rows with pagination
    const offset = (page - 1) * pageSize
    const rows = sqlite
      .prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`)
      .all(pageSize, offset) as Record<string, unknown>[]

    // Mask sensitive columns
    const maskedRows = rows.map((row) => {
      const masked: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        if (SENSITIVE_COLUMNS.has(key) && value) {
          masked[key] = "••••••••"
        } else {
          masked[key] = value
        }
      }
      return masked
    })

    return NextResponse.json({
      table,
      columns: columns.map((c) => ({
        name: c.name,
        type: c.type,
        notNull: c.notnull === 1,
        primaryKey: c.pk === 1,
        sensitive: SENSITIVE_COLUMNS.has(c.name),
      })),
      rows: maskedRows,
      totalRows: countRow.count,
      page,
      pageSize,
      totalPages: Math.ceil(countRow.count / pageSize),
    })
  } finally {
    sqlite.close()
  }
}
