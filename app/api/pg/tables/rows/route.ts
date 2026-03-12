import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPoolForDb } from "@/lib/api/get-pg-pool"
import {
  getTableRows,
  getTablePrimaryKeys,
  insertTableRow,
  updateTableRow,
  deleteTableRows,
  getTableColumns,
  type TableFilter,
} from "@/lib/pg/queries"

function authAndPool() {
  return async (dbName: string) => {
    const session = await getServerSession()
    if (!session) return { error: "Unauthorized", status: 401 }
    const pool = await getUserPoolForDb(session.user.id, dbName)
    if (!pool) return { error: "No connection configured", status: 400 }
    return { pool }
  }
}

// GET — Paginated rows
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const db = params.get("db")
  const schema = params.get("schema") || "public"
  const table = params.get("table")

  if (!db || !table)
    return NextResponse.json(
      { error: "db and table query parameters are required" },
      { status: 400 }
    )

  const resolve = authAndPool()
  const result = await resolve(db)
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status })

  const page = parseInt(params.get("page") || "1", 10)
  const pageSize = Math.min(parseInt(params.get("pageSize") || "50", 10), 500)
  const sort = params.get("sort") || undefined
  const sortDir = (params.get("sortDir") || "asc") as "asc" | "desc"
  const columnsParam = params.get("columns")
  const columns = columnsParam ? columnsParam.split(",") : undefined

  let filters: TableFilter[] = []
  const filtersParam = params.get("filters")
  if (filtersParam) {
    try {
      filters = JSON.parse(filtersParam)
    } catch {
      return NextResponse.json({ error: "Invalid filters JSON" }, { status: 400 })
    }
  }

  try {
    const [data, columnMeta] = await Promise.all([
      getTableRows(result.pool, schema, table, {
        page,
        pageSize,
        filters,
        sort,
        sortDir,
        columns,
      }),
      getTableColumns(result.pool, schema, table),
    ])
    return NextResponse.json({ ...data, columnMeta })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

// POST — Insert a row
export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { db, schema = "public", table, data } = await request.json()
    if (!db || !table || !data)
      return NextResponse.json(
        { error: "db, table, and data are required" },
        { status: 400 }
      )

    const pool = await getUserPoolForDb(session.user.id, db)
    if (!pool)
      return NextResponse.json({ error: "No connection configured" }, { status: 400 })

    const row = await insertTableRow(pool, schema, table, data)
    return NextResponse.json(row)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

// PATCH — Update a row by PK
export async function PATCH(request: NextRequest) {
  const session = await getServerSession()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { db, schema = "public", table, pkValues, data } = await request.json()
    if (!db || !table || !pkValues || !data)
      return NextResponse.json(
        { error: "db, table, pkValues, and data are required" },
        { status: 400 }
      )

    const pool = await getUserPoolForDb(session.user.id, db)
    if (!pool)
      return NextResponse.json({ error: "No connection configured" }, { status: 400 })

    const pkCols = await getTablePrimaryKeys(pool, schema, table)
    if (pkCols.length === 0)
      return NextResponse.json(
        { error: "Table has no primary key — cannot update" },
        { status: 400 }
      )

    const row = await updateTableRow(pool, schema, table, pkValues, data)
    if (!row)
      return NextResponse.json({ error: "Row not found" }, { status: 404 })

    return NextResponse.json(row)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

// DELETE — Delete rows by PK
export async function DELETE(request: NextRequest) {
  const session = await getServerSession()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { db, schema = "public", table, pkValueSets } = await request.json()
    if (!db || !table || !pkValueSets?.length)
      return NextResponse.json(
        { error: "db, table, and pkValueSets are required" },
        { status: 400 }
      )

    const pool = await getUserPoolForDb(session.user.id, db)
    if (!pool)
      return NextResponse.json({ error: "No connection configured" }, { status: 400 })

    const pkCols = await getTablePrimaryKeys(pool, schema, table)
    if (pkCols.length === 0)
      return NextResponse.json(
        { error: "Table has no primary key — cannot delete" },
        { status: 400 }
      )

    const result = await deleteTableRows(pool, schema, table, pkValueSets)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
