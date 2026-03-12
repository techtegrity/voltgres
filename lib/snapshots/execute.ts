import { execFile } from "child_process"
import { stat, unlink, mkdtemp } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { db } from "@/lib/db"
import { snapshot, connectionConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { uploadSnapshot } from "@/lib/storage/s3"

function runPgDump(args: string[], env: Record<string, string>, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "pg_dump",
      [...args, "-f", outputPath],
      { env: { ...process.env, ...env }, maxBuffer: 1024 * 1024 * 10 },
      (error) => {
        if (error) reject(error)
        else resolve()
      }
    )
    child.stderr?.on("data", (data) => {
      console.error(`[pg_dump stderr] ${data}`)
    })
  })
}

export async function executeSnapshot(snapshotId: string): Promise<void> {
  let tmpDir: string | null = null

  try {
    // Mark as running
    await db
      .update(snapshot)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(snapshot.id, snapshotId))

    // Get snapshot record
    const [snap] = await db
      .select()
      .from(snapshot)
      .where(eq(snapshot.id, snapshotId))

    if (!snap) throw new Error("Snapshot not found")

    // Get PG connection config for this user
    const [pgConfig] = await db
      .select()
      .from(connectionConfig)
      .where(eq(connectionConfig.userId, snap.userId))

    if (!pgConfig) throw new Error("No PostgreSQL connection configured")

    // Create temp directory
    const baseTmpDir = process.env.SNAPSHOT_TMP_DIR || tmpdir()
    tmpDir = await mkdtemp(join(baseTmpDir, "voltgres-snapshot-"))
    const dumpPath = join(tmpDir, `${snapshotId}.dump`)

    // Build pg_dump args
    const args = [
      "-Fc", // custom format (compressed)
      "-h", pgConfig.host,
      "-p", pgConfig.port.toString(),
      "-U", pgConfig.username,
      snap.database,
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

    // Run pg_dump
    await runPgDump(args, env, dumpPath)

    // Get file size
    const fileStats = await stat(dumpPath)

    // Build storage key
    const dateStr = new Date().toISOString().split("T")[0]
    const storageKey = `${snap.database}/${dateStr}/${snapshotId}.dump`

    // Upload to S3/R2
    await uploadSnapshot(dumpPath, storageKey)

    // Update snapshot record
    await db
      .update(snapshot)
      .set({
        status: "completed",
        sizeBytes: fileStats.size,
        storageKey,
        completedAt: new Date(),
      })
      .where(eq(snapshot.id, snapshotId))

    console.log(`[snapshot] Completed: ${snapshotId} (${snap.database}, ${fileStats.size} bytes)`)
  } catch (err) {
    const errorMsg = (err as Error).message || "Unknown error"
    console.error(`[snapshot] Failed: ${snapshotId} - ${errorMsg}`)

    await db
      .update(snapshot)
      .set({
        status: "failed",
        error: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(snapshot.id, snapshotId))
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
