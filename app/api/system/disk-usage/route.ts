import { NextResponse } from "next/server"
import { execSync } from "node:child_process"

export const dynamic = "force-dynamic"

interface DiskEntry {
  path: string
  label: string
  bytes: number
  percent: number
}

/**
 * Returns top-level directory sizes on the root filesystem.
 * Uses `du -sx` to stay on one filesystem and avoid crossing mounts.
 */
export async function GET() {
  try {
    // Get total disk size from df
    const dfOut = execSync("df -k /", { encoding: "utf-8" })
    const dfParts = dfOut.trim().split("\n")[1].split(/\s+/)
    const usedKb = parseInt(dfParts[2], 10)
    const freeKb = parseInt(dfParts[3], 10)
    const totalBytes = (usedKb + freeKb) * 1024
    const usedBytes = usedKb * 1024

    // Get top-level directory sizes (stay on same filesystem with -x)
    // Exclude virtual/system mounts and use a timeout to avoid hangs
    const duOut = execSync(
      "du -sx --block-size=1 /var /usr /home /opt /tmp /root /srv /boot /snap /etc /lib 2>/dev/null || true",
      { encoding: "utf-8", timeout: 15000 }
    )

    const entries: DiskEntry[] = []
    let accountedBytes = 0

    for (const line of duOut.trim().split("\n")) {
      if (!line) continue
      const [sizeStr, path] = line.split(/\t/)
      const bytes = parseInt(sizeStr, 10)
      if (isNaN(bytes) || bytes === 0) continue

      entries.push({
        path,
        label: path,
        bytes,
        percent: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
      })
      accountedBytes += bytes
    }

    // Add PostgreSQL data directory size separately for relevance
    let pgDataBytes = 0
    try {
      const pgOut = execSync(
        "du -sx --block-size=1 /var/lib/postgresql 2>/dev/null || echo '0\t/var/lib/postgresql'",
        { encoding: "utf-8", timeout: 10000 }
      )
      const pgLine = pgOut.trim().split("\n")[0]
      if (pgLine) {
        pgDataBytes = parseInt(pgLine.split(/\t/)[0], 10) || 0
      }
    } catch {
      // ignore
    }

    // Sort by size descending
    entries.sort((a, b) => b.bytes - a.bytes)

    // Calculate "other" (used space not accounted for by listed dirs)
    const otherBytes = Math.max(0, usedBytes - accountedBytes)
    if (otherBytes > 0) {
      entries.push({
        path: "(other)",
        label: "Other",
        bytes: otherBytes,
        percent: totalBytes > 0 ? Math.round((otherBytes / totalBytes) * 1000) / 10 : 0,
      })
    }

    return NextResponse.json({
      totalBytes,
      usedBytes,
      freeBytes: freeKb * 1024,
      entries,
      pgDataBytes,
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
