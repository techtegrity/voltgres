import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { testStorageConnection } from "@/lib/storage/s3"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { provider, bucket, region, endpoint, accessKeyId, secretAccessKey } = body

  if (!provider || !bucket || !accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      { error: "Provider, bucket, access key ID, and secret access key are required" },
      { status: 400 }
    )
  }

  // Don't test with masked secret
  if (secretAccessKey.startsWith("****")) {
    return NextResponse.json(
      { error: "Please enter the full secret access key to test the connection" },
      { status: 400 }
    )
  }

  const result = await testStorageConnection({
    provider,
    bucket,
    region: region || "us-east-1",
    endpoint: endpoint || undefined,
    accessKeyId,
    secretAccessKey,
  })

  return NextResponse.json(result)
}
