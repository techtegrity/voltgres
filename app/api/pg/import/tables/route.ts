import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { createTemporaryPool, listExternalTables } from "@/lib/pg/import"

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { host, port, user, password, database, ssl } = await request.json()
    if (!host || !port || !user || !database) {
      return NextResponse.json(
        { error: "host, port, user, and database are required" },
        { status: 400 }
      )
    }

    const pool = createTemporaryPool({
      host,
      port: parseInt(port, 10),
      user,
      password: password || "",
      database,
      ssl: ssl === true,
    })

    try {
      const tables = await listExternalTables(pool)
      return NextResponse.json(tables)
    } finally {
      await pool.end()
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
