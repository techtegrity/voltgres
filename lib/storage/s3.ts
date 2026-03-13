import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { db } from "@/lib/db"
import { storageConfig } from "@/lib/db/schema"
import { decrypt } from "@/lib/crypto"

export interface StorageClientResult {
  client: S3Client
  bucket: string
  prefix: string
}

async function getConfig() {
  const configs = await db.select().from(storageConfig).limit(1)
  return configs[0] ?? null
}

export async function getStorageClient(): Promise<StorageClientResult> {
  const config = await getConfig()
  if (!config) throw new Error("Storage not configured")

  return {
    client: new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: decrypt(config.secretAccessKey),
      },
      forcePathStyle: !!config.endpoint,
    }),
    bucket: config.bucket,
    prefix: config.pathPrefix || "",
  }
}

export async function uploadSnapshot(
  localPath: string,
  key: string
): Promise<void> {
  const { client, bucket, prefix } = await getStorageClient()
  const fullKey = prefix ? `${prefix}/${key}` : key
  const fileStats = await stat(localPath)
  const stream = createReadStream(localPath)

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fullKey,
      Body: stream,
      ContentLength: fileStats.size,
      ContentType: "application/octet-stream",
    })
  )
}

export async function downloadSnapshot(
  key: string
): Promise<ReadableStream | null> {
  const { client, bucket, prefix } = await getStorageClient()
  const fullKey = prefix ? `${prefix}/${key}` : key

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: fullKey,
    })
  )

  return (response.Body as ReadableStream) ?? null
}

export async function deleteSnapshotObject(key: string): Promise<void> {
  const { client, bucket, prefix } = await getStorageClient()
  const fullKey = prefix ? `${prefix}/${key}` : key

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: fullKey,
    })
  )
}

export async function getDownloadUrl(key: string): Promise<string> {
  const { client, bucket, prefix } = await getStorageClient()
  const fullKey = prefix ? `${prefix}/${key}` : key

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: fullKey,
    }),
    { expiresIn: 3600 }
  )

  return url
}

export async function testStorageConnection(config: {
  provider: string
  bucket: string
  region: string
  endpoint?: string
  accessKeyId: string
  secretAccessKey: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const clientConfig = {
      region: config.region,
      endpoint: config.endpoint || undefined,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: !!config.endpoint,
    }
    console.log("[StorageTest] S3 client config:", {
      region: clientConfig.region,
      endpoint: clientConfig.endpoint,
      forcePathStyle: clientConfig.forcePathStyle,
      accessKeyId: clientConfig.credentials.accessKeyId,
      bucket: config.bucket,
    })

    const client = new S3Client(clientConfig)

    await client.send(new HeadBucketCommand({ Bucket: config.bucket }))
    console.log("[StorageTest] HeadBucket succeeded")
    return { success: true }
  } catch (err: unknown) {
    const e = err as Error & { name?: string; $metadata?: Record<string, unknown>; Code?: string }
    console.error("[StorageTest] HeadBucket failed:", {
      name: e.name,
      message: e.message,
      code: e.Code,
      metadata: e.$metadata,
    })
    const detail = [e.name, e.message, e.Code].filter(Boolean).join(": ")
    return {
      success: false,
      error: detail || "Connection failed",
    }
  }
}
