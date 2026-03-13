import { NextResponse } from "next/server"
import { execSync } from "node:child_process"

export const dynamic = "force-dynamic"

interface DockerTypeUsage {
  total: number
  active: number
  size: number
  reclaimable: number
}

export interface DockerUsageData {
  available: boolean
  buildCache: DockerTypeUsage
  images: DockerTypeUsage
  containers: DockerTypeUsage
  volumes: DockerTypeUsage
}

/**
 * Returns Docker disk usage breakdown (build cache, images, volumes, containers).
 * Gracefully returns { available: false } if Docker socket is not accessible.
 */
export async function GET() {
  try {
    // Check if docker is accessible
    execSync("docker info", {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    })
  } catch (err) {
    console.log("[docker-usage] Docker not accessible:", (err as Error).message?.split("\n")[0])
    return NextResponse.json({ available: false })
  }

  try {
    const output = execSync("docker system df --format '{{json .}}'", {
      encoding: "utf-8",
      timeout: 10000,
    })

    const result: DockerUsageData = {
      available: true,
      buildCache: { total: 0, active: 0, size: 0, reclaimable: 0 },
      images: { total: 0, active: 0, size: 0, reclaimable: 0 },
      containers: { total: 0, active: 0, size: 0, reclaimable: 0 },
      volumes: { total: 0, active: 0, size: 0, reclaimable: 0 },
    }

    for (const line of output.trim().split("\n")) {
      if (!line) continue
      const row = JSON.parse(line)
      const type = (row.Type as string).toLowerCase().replace(/\s+/g, "")

      const entry: DockerTypeUsage = {
        total: parseInt(row.TotalCount, 10) || 0,
        active: parseInt(row.Active, 10) || 0,
        size: parseDockerSize(row.Size),
        reclaimable: parseDockerSize(row.Reclaimable),
      }

      if (type === "buildcache") result.buildCache = entry
      else if (type === "images") result.images = entry
      else if (type === "containers") result.containers = entry
      else if (type === "localvolumes") result.volumes = entry
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}

/**
 * Parse Docker's human-readable size strings like "24.38GB", "1.036MB", "212.6MB"
 */
function parseDockerSize(sizeStr: string): number {
  if (!sizeStr || sizeStr === "0B") return 0

  // Strip parenthesized percentage like "24.52GB (100%)"
  const cleaned = sizeStr.replace(/\s*\(.*?\)/, "").trim()

  const match = cleaned.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1000,
    MB: 1000 * 1000,
    GB: 1000 * 1000 * 1000,
    TB: 1000 * 1000 * 1000 * 1000,
  }
  return Math.round(value * (multipliers[unit] || 1))
}
