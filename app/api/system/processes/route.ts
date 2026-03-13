import { NextResponse } from "next/server"
import { execSync } from "node:child_process"

export const dynamic = "force-dynamic"

interface ProcessEntry {
  pid: number
  user: string
  cpuPercent: number
  memPercent: number
  rssBytes: number
  vsz: number
  command: string
}

/**
 * Returns top processes by CPU and memory usage, plus memory breakdown.
 */
export async function GET() {
  try {
    // Top processes by CPU
    const cpuOut = execSync(
      "ps aux --sort=-%cpu | head -16",
      { encoding: "utf-8", timeout: 5000 }
    )
    const cpuProcesses = parsePsOutput(cpuOut)

    // Top processes by memory
    const memOut = execSync(
      "ps aux --sort=-%mem | head -16",
      { encoding: "utf-8", timeout: 5000 }
    )
    const memProcesses = parsePsOutput(memOut)

    // Memory breakdown from /proc/meminfo
    let memInfo: Record<string, number> = {}
    try {
      const memInfoOut = execSync("cat /proc/meminfo", {
        encoding: "utf-8",
        timeout: 3000,
      })
      for (const line of memInfoOut.trim().split("\n")) {
        const match = line.match(/^(\w+):\s+(\d+)\s+kB/)
        if (match) {
          memInfo[match[1]] = parseInt(match[2], 10) * 1024 // convert to bytes
        }
      }
    } catch {
      // /proc/meminfo might not be available
    }

    // CPU info
    let cpuCores = 0
    let cpuModel = ""
    try {
      const cpuInfoOut = execSync(
        "grep -c ^processor /proc/cpuinfo && grep 'model name' /proc/cpuinfo | head -1",
        { encoding: "utf-8", timeout: 3000 }
      )
      const lines = cpuInfoOut.trim().split("\n")
      cpuCores = parseInt(lines[0], 10) || 0
      const modelMatch = lines[1]?.match(/model name\s*:\s*(.+)/)
      cpuModel = modelMatch ? modelMatch[1].trim() : ""
    } catch {
      // fallback
    }

    // Load averages
    let loadAvg: number[] = []
    try {
      const loadOut = execSync("cat /proc/loadavg", {
        encoding: "utf-8",
        timeout: 3000,
      })
      loadAvg = loadOut
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .map(Number)
    } catch {
      // ignore
    }

    return NextResponse.json({
      topByCpu: cpuProcesses,
      topByMemory: memProcesses,
      cpuInfo: {
        cores: cpuCores,
        model: cpuModel,
        loadAvg,
      },
      memoryBreakdown: {
        total: memInfo.MemTotal || 0,
        free: memInfo.MemFree || 0,
        available: memInfo.MemAvailable || 0,
        buffers: memInfo.Buffers || 0,
        cached: memInfo.Cached || 0,
        swapTotal: memInfo.SwapTotal || 0,
        swapFree: memInfo.SwapFree || 0,
        shmem: memInfo.Shmem || 0,
        sreclaimable: memInfo.SReclaimable || 0,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}

function parsePsOutput(output: string): ProcessEntry[] {
  const lines = output.trim().split("\n")
  // Skip header line
  const entries: ProcessEntry[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/)
    if (parts.length < 11) continue
    const user = parts[0]
    const pid = parseInt(parts[1], 10)
    const cpuPercent = parseFloat(parts[2])
    const memPercent = parseFloat(parts[3])
    const vsz = parseInt(parts[4], 10) * 1024 // KB to bytes
    const rssBytes = parseInt(parts[5], 10) * 1024 // KB to bytes
    // Command is everything from column 10 onwards
    const command = parts.slice(10).join(" ")
    entries.push({ pid, user, cpuPercent, memPercent, rssBytes, vsz, command })
  }
  return entries
}
