import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { storageConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { encrypt, decrypt } from "@/lib/crypto"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const configs = await db.select().from(storageConfig).limit(1)
  const config = configs[0]

  if (!config) {
    return NextResponse.json(null)
  }

  // Decrypt and mask the secret key
  const rawSecret = config.secretAccessKey ? decrypt(config.secretAccessKey) : ""
  return NextResponse.json({
    ...config,
    secretAccessKey: rawSecret
      ? `****${rawSecret.slice(-4)}`
      : "",
  })
}

export async function PUT(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { provider, bucket, region, endpoint, accessKeyId, secretAccessKey, pathPrefix } = body

  if (!provider || !bucket || !accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      { error: "Provider, bucket, access key ID, and secret access key are required" },
      { status: 400 }
    )
  }

  try {
    const now = new Date()
    const existing = await db.select().from(storageConfig).limit(1)
    console.log("[StorageAPI] PUT: existing config?", existing.length > 0)

    if (existing.length > 0) {
      // Check if secretAccessKey is the masked value — if so, keep the old one
      const isMasked = secretAccessKey.startsWith("****")
      console.log("[StorageAPI] PUT: secret is masked?", isMasked)
      const actualSecret = isMasked ? existing[0].secretAccessKey : encrypt(secretAccessKey)

      await db
        .update(storageConfig)
        .set({
          provider,
          bucket,
          region: region || "us-east-1",
          endpoint: endpoint || null,
          accessKeyId,
          secretAccessKey: actualSecret,
          pathPrefix: pathPrefix || "",
          updatedAt: now,
        })
        .where(eq(storageConfig.id, existing[0].id))
      console.log("[StorageAPI] PUT: updated successfully")
    } else {
      console.log("[StorageAPI] PUT: inserting new config")
      await db.insert(storageConfig).values({
        id: crypto.randomUUID(),
        provider,
        bucket,
        region: region || "us-east-1",
        endpoint: endpoint || null,
        accessKeyId,
        secretAccessKey: encrypt(secretAccessKey),
        pathPrefix: pathPrefix || "",
        createdAt: now,
        updatedAt: now,
      })
      console.log("[StorageAPI] PUT: inserted successfully")
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[StorageAPI] PUT error:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Failed to save storage config" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const existing = await db.select().from(storageConfig).limit(1)
  if (existing.length > 0) {
    await db.delete(storageConfig).where(eq(storageConfig.id, existing[0].id))
  }

  return NextResponse.json({ success: true })
}
