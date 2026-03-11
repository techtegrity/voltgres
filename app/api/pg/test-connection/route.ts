import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { testConnection } from "@/lib/pg/connection"

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { host, port, username, password, ssl } = await request.json()
    if (!host || !port || !username) {
      return NextResponse.json(
        { error: "host, port, and username are required" },
        { status: 400 }
      )
    }

    const result = await testConnection({
      host,
      port: parseInt(port, 10),
      user: username,
      password: password || "",
      ssl: ssl === true,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
