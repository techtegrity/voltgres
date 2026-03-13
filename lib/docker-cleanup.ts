import cron from "node-cron"
import { execSync } from "node:child_process"

let task: cron.ScheduledTask | null = null

/**
 * Schedule daily Docker build cache cleanup at 3:00 AM.
 * Prunes build cache entries older than 48 hours.
 * Gracefully no-ops if Docker socket is not available.
 */
export function initDockerCleanup() {
  // Check if Docker is accessible
  try {
    execSync("docker info", {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    })
  } catch {
    console.log("[docker-cleanup] Docker socket not available — skipping auto-cleanup setup")
    return
  }

  // Daily at 3:00 AM
  task = cron.schedule("0 3 * * *", () => {
    console.log("[docker-cleanup] Running scheduled build cache cleanup...")
    try {
      const output = execSync(
        'docker builder prune -a --filter "until=48h" -f',
        { encoding: "utf-8", timeout: 120000 }
      )
      const match = output.match(
        /Total reclaimed space:\s*([\d.]+\s*\w+)/i
      )
      const reclaimed = match ? match[1] : "0B"
      console.log(`[docker-cleanup] Done — reclaimed ${reclaimed}`)
    } catch (err) {
      console.error("[docker-cleanup] Failed:", (err as Error).message)
    }
  })

  console.log("[docker-cleanup] Scheduled daily build cache cleanup at 3:00 AM")
}

export function stopDockerCleanup() {
  if (task) {
    task.stop()
    task = null
    console.log("[docker-cleanup] Stopped scheduled cleanup")
  }
}
