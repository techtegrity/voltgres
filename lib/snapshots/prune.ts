import { db } from "@/lib/db"
import { backupConfig, snapshot } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { deleteSnapshotObject } from "@/lib/storage/s3"

/**
 * Prune old snapshots for a backup config based on its retention policy.
 *
 * Policy:
 * - Keep the most recent `retentionKeepLast` completed snapshots unconditionally
 * - Beyond that, group older snapshots into calendar buckets of `retentionThinKeepEvery` days
 * - Keep the newest snapshot in each bucket, delete the rest
 */
export async function pruneSnapshots(configId: string): Promise<void> {
  // Load config
  const [config] = await db
    .select()
    .from(backupConfig)
    .where(eq(backupConfig.id, configId))

  if (!config || !config.pruningEnabled) return

  const { retentionKeepLast, retentionThinKeepEvery } = config

  // Get all completed snapshots for this config, newest first
  const snaps = await db
    .select()
    .from(snapshot)
    .where(
      and(
        eq(snapshot.backupConfigId, configId),
        eq(snapshot.status, "completed")
      )
    )
    .orderBy(desc(snapshot.completedAt))

  if (snaps.length <= retentionKeepLast) return

  // Split into keep (recent) and candidates (older)
  const recent = snaps.slice(0, retentionKeepLast)
  const older = snaps.slice(retentionKeepLast)

  if (older.length === 0) return

  // Group older snapshots into buckets of retentionThinKeepEvery days
  // Bucket key = floor((now - completedAt) / bucketSizeDays)
  const now = Date.now()
  const bucketSizeMs = retentionThinKeepEvery * 24 * 60 * 60 * 1000

  const buckets = new Map<number, typeof older>()

  for (const snap of older) {
    const completedAt = snap.completedAt?.getTime() ?? snap.createdAt.getTime()
    const ageMs = now - completedAt
    const bucketIndex = Math.floor(ageMs / bucketSizeMs)

    if (!buckets.has(bucketIndex)) {
      buckets.set(bucketIndex, [])
    }
    buckets.get(bucketIndex)!.push(snap)
  }

  // In each bucket, keep the newest (first since ordered by completedAt DESC),
  // delete the rest
  const toDelete: typeof older = []

  for (const [, bucketSnaps] of buckets) {
    // bucketSnaps are already in newest-first order from the original query
    const [_keep, ...excess] = bucketSnaps
    toDelete.push(...excess)
  }

  if (toDelete.length === 0) return

  console.log(
    `[prune] Pruning ${toDelete.length} snapshot(s) for config "${config.name}" (keeping ${recent.length} recent + ${older.length - toDelete.length} archived)`
  )

  for (const snap of toDelete) {
    // Delete from S3/R2
    if (snap.storageKey) {
      try {
        await deleteSnapshotObject(snap.storageKey)
      } catch (err) {
        console.error(`[prune] Failed to delete from storage: ${snap.storageKey}`, err)
      }
    }

    // Delete from DB
    await db.delete(snapshot).where(eq(snapshot.id, snap.id))
  }

  console.log(`[prune] Done pruning for config "${config.name}"`)
}
