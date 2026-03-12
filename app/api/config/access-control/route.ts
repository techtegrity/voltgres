import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { db } from "@/lib/db"
import { accessRule } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { invalidateAccessRuleCache } from "@/lib/access-control"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rules = await db
    .select()
    .from(accessRule)
    .orderBy(desc(accessRule.createdAt))

  return NextResponse.json(rules)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { type, value, description } = await request.json()

    if (!type || !value) {
      return NextResponse.json(
        { error: "Type and value are required" },
        { status: 400 }
      )
    }

    if (!["ip", "cidr", "header_secret"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be ip, cidr, or header_secret" },
        { status: 400 }
      )
    }

    // Basic validation
    if (type === "cidr" && !value.includes("/")) {
      return NextResponse.json(
        { error: "CIDR must include a prefix length (e.g. 10.0.0.0/8)" },
        { status: 400 }
      )
    }

    const now = new Date()
    const id = crypto.randomUUID()

    await db.insert(accessRule).values({
      id,
      type,
      value: value.trim(),
      description: description?.trim() || "",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })

    invalidateAccessRuleCache()

    return NextResponse.json({ id, success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
