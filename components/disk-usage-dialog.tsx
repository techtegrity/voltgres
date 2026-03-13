"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
  HardDrive,
  Database,
  FolderOpen,
  Loader2,
  Trash2,
  Container,
  Check,
} from "lucide-react"
import {
  api,
  type DiskUsageData,
  type DockerUsageData,
} from "@/lib/api-client"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

const DIR_COLORS = [
  "hsl(217, 91%, 60%)", // blue
  "hsl(142, 71%, 45%)", // green
  "hsl(38, 92%, 50%)", // amber
  "hsl(280, 67%, 55%)", // purple
  "hsl(0, 72%, 51%)", // red
  "hsl(190, 80%, 45%)", // cyan
  "hsl(340, 75%, 55%)", // pink
  "hsl(60, 70%, 45%)", // yellow
  "hsl(25, 85%, 55%)", // orange
  "hsl(160, 60%, 40%)", // teal
  "hsl(220, 40%, 50%)", // slate
]

export function DiskUsageDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [data, setData] = useState<DiskUsageData | null>(null)
  const [dockerData, setDockerData] = useState<DockerUsageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pruning, setPruning] = useState<string | null>(null)
  const [pruneSuccess, setPruneSuccess] = useState<string | null>(null)

  const fetchAll = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      api.system.diskUsage(),
      api.system.dockerUsage().catch((err) => {
        console.warn("[disk-usage] Docker usage fetch failed:", err)
        return null
      }),
    ])
      .then(([diskData, docker]) => {
        setData(diskData)
        if (docker) console.log("[disk-usage] Docker data:", docker)
        setDockerData(docker)
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!open) {
      setPruneSuccess(null)
      return
    }
    fetchAll()
  }, [open, fetchAll])

  const handlePrune = async (target: "build-cache" | "images" | "all") => {
    setPruning(target)
    setPruneSuccess(null)
    try {
      const result = await api.system.dockerPrune(target)
      setPruneSuccess(
        `Reclaimed ${formatBytes(result.reclaimedBytes)}`
      )
      // Re-fetch to update all numbers
      fetchAll()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPruning(null)
    }
  }

  const usedPercent = data
    ? Math.round((data.usedBytes / data.totalBytes) * 1000) / 10
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Disk Usage
          </DialogTitle>
          <DialogDescription>
            Breakdown of disk space on the root filesystem
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-destructive text-sm py-4">
            Failed to load disk usage: {error}
          </div>
        )}

        {data && !loading && (
          <div className="space-y-5">
            {/* Summary bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatBytes(data.usedBytes)} used of{" "}
                  {formatBytes(data.totalBytes)}
                </span>
                <span className="font-medium">
                  {formatBytes(data.freeBytes)} free
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                {data.entries.map((entry, i) => {
                  const widthPct = (entry.bytes / data.totalBytes) * 100
                  if (widthPct < 0.3) return null
                  return (
                    <div
                      key={entry.path}
                      className="h-full transition-all duration-300 first:rounded-l-full"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: DIR_COLORS[i % DIR_COLORS.length],
                        opacity: 0.85,
                      }}
                      title={`${entry.label}: ${formatBytes(entry.bytes)}`}
                    />
                  )
                })}
              </div>
            </div>

            {/* Docker section */}
            {dockerData?.available && (
              <DockerSection
                docker={dockerData}
                pruning={pruning}
                pruneSuccess={pruneSuccess}
                onPrune={handlePrune}
              />
            )}

            {/* PostgreSQL callout */}
            {data.pgDataBytes > 0 && (
              <div className="flex items-center gap-3 rounded-md bg-muted/50 border border-border px-3 py-2">
                <Database className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">PostgreSQL Data</div>
                  <div className="text-xs text-muted-foreground">
                    /var/lib/postgresql
                  </div>
                </div>
                <span className="text-sm font-mono tabular-nums">
                  {formatBytes(data.pgDataBytes)}
                </span>
              </div>
            )}

            {/* Directory list */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
                By directory
              </p>
              {data.entries.map((entry, i) => (
                <DirectoryRow
                  key={entry.path}
                  entry={entry}
                  totalBytes={data.totalBytes}
                  color={DIR_COLORS[i % DIR_COLORS.length]}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DockerSection({
  docker,
  pruning,
  pruneSuccess,
  onPrune,
}: {
  docker: DockerUsageData
  pruning: string | null
  pruneSuccess: string | null
  onPrune: (target: "build-cache" | "images" | "all") => void
}) {
  const rows: {
    label: string
    size: number
    reclaimable: number
    target: "build-cache" | "images" | null
    detail: string
  }[] = [
    {
      label: "Build Cache",
      size: docker.buildCache.size,
      reclaimable: docker.buildCache.reclaimable,
      target: "build-cache",
      detail: `${docker.buildCache.total} entries, ${docker.buildCache.active} active`,
    },
    {
      label: "Images",
      size: docker.images.size,
      reclaimable: docker.images.reclaimable,
      target: "images",
      detail: `${docker.images.total} total, ${docker.images.active} in use`,
    },
    {
      label: "Volumes",
      size: docker.volumes.size,
      reclaimable: 0,
      target: null,
      detail: `${docker.volumes.total} total, ${docker.volumes.active} in use`,
    },
  ]

  // Only show if there's meaningful Docker usage
  const totalSize = rows.reduce((s, r) => s + r.size, 0)
  if (totalSize === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        Docker Storage
      </p>
      <div className="rounded-md border border-border divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center gap-3 px-3 py-2"
          >
            <Container className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{row.label}</div>
              <div className="text-xs text-muted-foreground">{row.detail}</div>
            </div>
            <span className="text-sm font-mono tabular-nums shrink-0">
              {formatBytes(row.size)}
            </span>
            {row.target && row.reclaimable > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={pruning !== null}
                      onClick={() => onPrune(row.target!)}
                    >
                      {pruning === row.target ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>
                      Clean {row.label.toLowerCase()} — reclaim{" "}
                      {formatBytes(row.reclaimable)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ))}
      </div>
      {pruneSuccess && (
        <div className="flex items-center gap-2 text-xs text-emerald-500">
          <Check className="w-3.5 h-3.5" />
          {pruneSuccess}
        </div>
      )}
    </div>
  )
}

function DirectoryRow({
  entry,
  totalBytes,
  color,
}: {
  entry: { path: string; label: string; bytes: number; percent: number }
  totalBytes: number
  color: string
}) {
  const widthPct = Math.max((entry.bytes / totalBytes) * 100, 0.5)

  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors">
      <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span
        className="text-sm min-w-0 truncate flex-1 font-mono"
        title={entry.path}
      >
        {entry.path}
      </span>
      <div className="w-24 shrink-0">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${widthPct}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-16 text-right shrink-0">
        {formatBytes(entry.bytes)}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right shrink-0">
        {entry.percent}%
      </span>
    </div>
  )
}
