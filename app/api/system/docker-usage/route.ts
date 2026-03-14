import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { execFileSync, execSync } from "node:child_process"
import { existsSync } from "node:fs"

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
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Step 1: Check if docker socket exists
  if (!existsSync("/var/run/docker.sock")) {
    console.log("[docker-usage] Socket /var/run/docker.sock does not exist")
    return NextResponse.json({ available: false })
  }

  // Step 2: Find docker binary
  let dockerBin = ""
  for (const p of ["/usr/bin/docker", "/usr/local/bin/docker"]) {
    if (existsSync(p)) {
      dockerBin = p
      break
    }
  }
  if (!dockerBin) {
    console.log("[docker-usage] docker binary not found")
    return NextResponse.json({ available: false })
  }

  // Step 3: Check docker connectivity (use execFileSync to bypass shell)
  try {
    execFileSync(dockerBin, ["info"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    })
  } catch (err) {
    const msg = (err as Error).message?.split("\n")[0] || "unknown"
    console.log("[docker-usage] docker info failed:", msg)
    return NextResponse.json({ available: false })
  }

  // Step 4: Get disk usage via `docker system df`
  try {
    // Use execFileSync with args array to avoid shell quoting issues
    const output = execFileSync(
      dockerBin,
      ["system", "df", "--format", "{{json .}}"],
      {
        encoding: "utf-8",
        timeout: 10000,
      }
    )

    console.log("[docker-usage] raw output:", output.trim().substring(0, 200))

    const result: DockerUsageData = {
      available: true,
      buildCache: { total: 0, active: 0, size: 0, reclaimable: 0 },
      images: { total: 0, active: 0, size: 0, reclaimable: 0 },
      containers: { total: 0, active: 0, size: 0, reclaimable: 0 },
      volumes: { total: 0, active: 0, size: 0, reclaimable: 0 },
    }

    for (const line of output.trim().split("\n")) {
      if (!line) continue
      try {
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
      } catch (parseErr) {
        console.log("[docker-usage] Failed to parse line:", line)
      }
    }

    console.log("[docker-usage] Returning:", JSON.stringify(result).substring(0, 200))
    return NextResponse.json(result)
  } catch (err) {
    const msg = (err as Error).message || "unknown"
    console.log("[docker-usage] docker system df failed:", msg)
    return NextResponse.json(
      { error: msg },
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

  const match = cleaned.match(/^([\d.]+)\s*(B|KB|kB|MB|GB|TB)$/i)
  if (!match) {
    console.log("[docker-usage] Failed to parse size:", sizeStr)
    return 0
  }

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
