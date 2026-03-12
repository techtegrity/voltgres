import { execFile } from "child_process"
import { writeFile, unlink, mkdtemp } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { Readable } from "stream"
import { db } from "@/lib/db"
import { snapshot, connectionConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { downloadSnapshot } from "@/lib/storage/s3"

function runPgRestore(args: string[], env: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "pg_restore",
      args,
      { env: { ...process.env, ...env }, maxBuffer: 1024 * 1024 * 10 },
      (error, stdout, stderr) => {
        // pg_restore returns non-zero for warnings too, check if it's actually fatal
        if (error && !stderr.includes("WARNING")) {
          reject(new Error(stderr || error.message))
        } else {
          resolve(stdout)
        }
      }
    )
  })
}

async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export async function executeRestore(
  snapshotId: string,
  targetDatabase?: string
): Promise<void> {
  let tmpDir: string | null = null

  try {
    // Get snapshot record
    const [snap] = await db
      .select()
      .from(snapshot)
      .where(eq(snapshot.id, snapshotId))

    if (!snap) throw new Error("Snapshot not found")
    if (snap.status !== "completed") throw new Error("Snapshot is not completed")
    if (!snap.storageKey) throw new Error("Snapshot has no storage key")

    const dbName = targetDatabase || snap.database

    // Get PG connection config
    const [pgConfig] = await db
      .select()
      .from(connectionConfig)
      .where(eq(connectionConfig.userId, snap.userId))

    if (!pgConfig) throw new Error("No PostgreSQL connection configured")

    // Download from S3/R2
    const stream = await downloadSnapshot(snap.storageKey)
    if (!stream) throw new Error("Failed to download snapshot from storage")

    // Write to temp file
    const baseTmpDir = process.env.SNAPSHOT_TMP_DIR || tmpdir()
    tmpDir = await mkdtemp(join(baseTmpDir, "voltgres-restore-"))
    const dumpPath = join(tmpDir, `${snapshotId}.dump`)

    const buffer = await streamToBuffer(stream)
    await writeFile(dumpPath, buffer)

    // Build pg_restore args
    const args = [
      "--clean",
      "--if-exists",
      "-h", pgConfig.host,
      "-p", pgConfig.port.toString(),
      "-U", pgConfig.username,
      "-d", dbName,
      dumpPath,
    ]

    const env: Record<string, string> = {}
    if (pgConfig.password) {
      env.PGPASSWORD = pgConfig.password
    }
    if (pgConfig.sslMode === "disable") {
      env.PGSSLMODE = "disable"
    } else if (pgConfig.sslMode && pgConfig.sslMode !== "prefer") {
      env.PGSSLMODE = pgConfig.sslMode
    }

    // Run pg_restore
    await runPgRestore(args, env)

    console.log(`[restore] Completed: snapshot ${snapshotId} → database ${dbName}`)
  } finally {
    // Clean up temp directory
    if (tmpDir) {
      try {
        const { rm } = await import("fs/promises")
        await rm(tmpDir, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
