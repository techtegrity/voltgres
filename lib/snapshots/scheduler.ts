import cron from "node-cron"
import { db } from "@/lib/db"
import { backupConfig, snapshot } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { executeSnapshot } from "./execute"

const jobs = new Map<string, cron.ScheduledTask>()

export async function initScheduler() {
  console.log("[scheduler] Initializing backup scheduler...")

  // Mark any interrupted snapshots as failed
  const running = await db
    .select()
    .from(snapshot)
    .where(
      eq(snapshot.status, "running")
    )

  for (const snap of running) {
    await db
      .update(snapshot)
      .set({
        status: "failed",
        error: "Interrupted by server restart",
        completedAt: new Date(),
      })
      .where(eq(snapshot.id, snap.id))
  }

  const pending = await db
    .select()
    .from(snapshot)
    .where(eq(snapshot.status, "pending"))

  for (const snap of pending) {
    await db
      .update(snapshot)
      .set({
        status: "failed",
        error: "Interrupted by server restart",
        completedAt: new Date(),
      })
      .where(eq(snapshot.id, snap.id))
  }

  // Load all enabled backup configs
  const configs = await db
    .select()
    .from(backupConfig)
    .where(eq(backupConfig.enabled, true))

  for (const config of configs) {
    scheduleJob(config)
  }

  console.log(`[scheduler] Loaded ${configs.length} backup schedule(s)`)
}

function scheduleJob(config: typeof backupConfig.$inferSelect) {
  if (!cron.validate(config.schedule)) {
    console.error(`[scheduler] Invalid cron expression for ${config.name}: ${config.schedule}`)
    return
  }

  const task = cron.schedule(config.schedule, async () => {
    console.log(`[scheduler] Running scheduled backup: ${config.name}`)

    const databases: string[] = JSON.parse(config.databases)

    for (const database of databases) {
      // Check if a snapshot is already running for this database
      const existing = await db
        .select()
        .from(snapshot)
        .where(
          and(
            eq(snapshot.database, database),
            eq(snapshot.status, "running")
          )
        )

      if (existing.length > 0) {
        console.log(`[scheduler] Skipping ${database} — snapshot already running`)
        continue
      }

      const id = crypto.randomUUID()
      const now = new Date()

      await db.insert(snapshot).values({
        id,
        database,
        status: "pending",
        trigger: "scheduled",
        backupConfigId: config.id,
        createdAt: now,
        userId: config.userId,
      })

      executeSnapshot(id).catch((err) => {
        console.error(`[scheduler] Snapshot failed for ${database}:`, err)
      })
    }

    // Update lastRun
    await db
      .update(backupConfig)
      .set({ lastRun: new Date() })
      .where(eq(backupConfig.id, config.id))
  })

  jobs.set(config.id, task)
}

export async function reloadSchedule(backupConfigId: string) {
  // Stop existing job
  const existing = jobs.get(backupConfigId)
  if (existing) {
    existing.stop()
    jobs.delete(backupConfigId)
  }

  // Re-load config
  const [config] = await db
    .select()
    .from(backupConfig)
    .where(eq(backupConfig.id, backupConfigId))

  if (config && config.enabled) {
    scheduleJob(config)
    console.log(`[scheduler] Reloaded schedule: ${config.name}`)
  }
}

export function stopScheduler() {
  for (const [id, task] of jobs) {
    task.stop()
  }
  jobs.clear()
  console.log("[scheduler] Stopped all scheduled jobs")
}
