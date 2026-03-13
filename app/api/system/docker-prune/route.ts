import { NextResponse } from "next/server"
import { execSync } from "node:child_process"

export const dynamic = "force-dynamic"

type PruneTarget = "build-cache" | "images" | "all"

const COMMANDS: Record<PruneTarget, { cmd: string; label: string }> = {
  "build-cache": {
    cmd: "docker builder prune -a -f",
    label: "build cache",
  },
  images: {
    cmd: "docker image prune -a -f",
    label: "unused images",
  },
  all: {
    cmd: "docker system prune -a -f",
    label: "all unused Docker data",
  },
}

/**
 * Prune Docker resources (build cache, unused images, or all).
 * Returns the amount of space reclaimed.
 */
export async function POST(request: Request) {
  let body: { target?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const target = body.target as PruneTarget
  if (!target || !COMMANDS[target]) {
    return NextResponse.json(
      { error: `Invalid target. Must be one of: ${Object.keys(COMMANDS).join(", ")}` },
      { status: 400 }
    )
  }

  // Check if docker is accessible
  try {
    execSync("docker info", {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    })
  } catch {
    return NextResponse.json(
      { error: "Docker is not available" },
      { status: 503 }
    )
  }

  try {
    const { cmd, label } = COMMANDS[target]
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 120000, // 2 min timeout for large prunes
    })

    // Parse "Total reclaimed space: X.XXgb" from output
    const reclaimedMatch = output.match(
      /Total reclaimed space:\s*([\d.]+)\s*(B|kB|MB|GB|TB)/i
    )
    let reclaimedBytes = 0
    if (reclaimedMatch) {
      const value = parseFloat(reclaimedMatch[1])
      const unit = reclaimedMatch[2].toUpperCase()
      const multipliers: Record<string, number> = {
        B: 1,
        KB: 1000,
        MB: 1000 * 1000,
        GB: 1000 * 1000 * 1000,
        TB: 1000 * 1000 * 1000 * 1000,
      }
      reclaimedBytes = Math.round(value * (multipliers[unit] || 1))
    }

    console.log(`[docker-prune] Cleaned ${label}: reclaimed ${reclaimedBytes} bytes`)

    return NextResponse.json({
      reclaimedBytes,
      message: `Cleaned ${label}`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
