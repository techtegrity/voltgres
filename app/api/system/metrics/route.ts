import { NextResponse } from "next/server"
import os from "node:os"
import { execSync } from "node:child_process"

export const dynamic = "force-dynamic"

function getCpuUsage(): number {
  try {
    // Read /proc/stat for accurate CPU usage since boot
    const stat = execSync("cat /proc/stat", { encoding: "utf-8" })
    const cpuLine = stat.split("\n")[0] // "cpu  user nice system idle iowait irq softirq steal"
    const parts = cpuLine.replace(/^cpu\s+/, "").split(/\s+/).map(Number)
    const idle = parts[3] + (parts[4] || 0) // idle + iowait
    const total = parts.reduce((a, b) => a + b, 0)
    return total > 0 ? Math.round(((total - idle) / total) * 1000) / 10 : 0
  } catch {
    // Fallback: derive from load average vs cores
    const load = os.loadavg()[0]
    const cores = os.cpus().length
    return Math.min(Math.round((load / cores) * 1000) / 10, 100)
  }
}

function getDiskUsage(): {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usagePercent: number
  mountPoint: string
} {
  try {
    // df -k works on both Linux and macOS (output in 1K blocks)
    const output = execSync("df -k /", { encoding: "utf-8" })
    const lines = output.trim().split("\n")
    const parts = lines[1].split(/\s+/)
    const used = parseInt(parts[2], 10) * 1024
    const free = parseInt(parts[3], 10) * 1024
    // Use used+free as effective total (handles macOS APFS correctly)
    const total = used + free
    // Parse the OS-reported capacity % (e.g. "43%")
    const capStr = parts.find((p) => p.endsWith("%"))
    const usagePercent = capStr ? parseInt(capStr, 10) : total > 0 ? Math.round((used / total) * 1000) / 10 : 0
    return {
      totalBytes: total,
      usedBytes: used,
      freeBytes: free,
      usagePercent,
      mountPoint: parts[parts.length - 1],
    }
  } catch {
    return {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      usagePercent: 0,
      mountPoint: "/",
    }
  }
}

export async function GET() {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  const cpus = os.cpus()
  const disk = getDiskUsage()

  return NextResponse.json({
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model?.trim() || "Unknown",
      usagePercent: getCpuUsage(),
      loadAvg: os.loadavg().map((v) => Math.round(v * 100) / 100),
    },
    memory: {
      totalBytes: totalMem,
      usedBytes: usedMem,
      freeBytes: freeMem,
      usagePercent: Math.round((usedMem / totalMem) * 1000) / 10,
    },
    disk,
    uptime: Math.floor(os.uptime()),
    timestamp: Date.now(),
  })
}
