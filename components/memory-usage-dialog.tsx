"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { MemoryStick, Loader2 } from "lucide-react"
import { api, type ProcessesData } from "@/lib/api-client"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function shortenCommand(cmd: string): string {
  const parts = cmd.split(/\s+/)
  const exec = parts[0]
  const basename = exec.split("/").pop() || exec
  if (["python3", "python", "node", "ruby", "java", "perl"].includes(basename) && parts[1]) {
    const scriptName = parts[1].split("/").pop() || parts[1]
    return `${basename} ${scriptName}`
  }
  return basename
}

const SEGMENT_COLORS = {
  used: "hsl(38, 92%, 50%)",     // amber
  buffers: "hsl(217, 91%, 60%)", // blue
  cached: "hsl(142, 71%, 45%)",  // green
  free: "hsl(0, 0%, 30%)",       // dark gray (part of bg)
}

const BAR_COLORS = [
  "hsl(280, 67%, 55%)",  // purple (highest)
  "hsl(260, 60%, 55%)",  // violet
  "hsl(217, 91%, 60%)",  // blue
  "hsl(190, 80%, 45%)",  // cyan
  "hsl(160, 60%, 40%)",  // teal
  "hsl(142, 71%, 45%)",  // green (rest)
]

function getBarColor(index: number): string {
  if (index < BAR_COLORS.length - 1) return BAR_COLORS[index]
  return BAR_COLORS[BAR_COLORS.length - 1]
}

export function MemoryUsageDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [data, setData] = useState<ProcessesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    api.system
      .processes()
      .then(setData)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [open])

  const mb = data?.memoryBreakdown
  const total = mb?.total || 1

  // Calculate actual "used" memory (excluding buffers/cache)
  const actualUsed = mb
    ? mb.total - mb.available
    : 0
  const buffersCache = mb
    ? mb.buffers + mb.cached + mb.sreclaimable
    : 0
  const appUsed = mb
    ? Math.max(0, actualUsed - buffersCache + (mb.shmem || 0))
    : 0

  const segments = mb
    ? [
        { label: "App / processes", bytes: appUsed, color: SEGMENT_COLORS.used },
        { label: "Buffers", bytes: mb.buffers, color: SEGMENT_COLORS.buffers },
        { label: "Cached", bytes: mb.cached + mb.sreclaimable, color: SEGMENT_COLORS.cached },
      ]
    : []

  const maxMem = data
    ? Math.max(...data.topByMemory.map((p) => p.memPercent), 1)
    : 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MemoryStick className="w-5 h-5" />
            Memory Usage
          </DialogTitle>
          <DialogDescription>
            Breakdown of system memory and top processes
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-destructive text-sm py-4">
            Failed to load memory info: {error}
          </div>
        )}

        {data && mb && !loading && (
          <div className="space-y-5">
            {/* Memory summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatBytes(actualUsed)} used of {formatBytes(total)}
                </span>
                <span className="font-medium">
                  {formatBytes(mb.available)} available
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                {segments.map((seg) => {
                  const widthPct = (seg.bytes / total) * 100
                  if (widthPct < 0.3) return null
                  return (
                    <div
                      key={seg.label}
                      className="h-full transition-all duration-300 first:rounded-l-full"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: seg.color,
                        opacity: 0.85,
                      }}
                      title={`${seg.label}: ${formatBytes(seg.bytes)}`}
                    />
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {segments.map((seg) => (
                  <div key={seg.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    {seg.label}: {formatBytes(seg.bytes)}
                  </div>
                ))}
              </div>
            </div>

            {/* Swap info if any */}
            {mb.swapTotal > 0 && (
              <div className="flex items-center gap-3 rounded-md bg-muted/50 border border-border px-3 py-2">
                <MemoryStick className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Swap</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(mb.swapTotal - mb.swapFree)} used of {formatBytes(mb.swapTotal)}
                  </div>
                </div>
                <span className="text-sm font-mono tabular-nums">
                  {mb.swapTotal > 0
                    ? Math.round(((mb.swapTotal - mb.swapFree) / mb.swapTotal) * 100)
                    : 0}%
                </span>
              </div>
            )}

            {/* Process list */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
                Top processes by memory
              </p>
              {data.topByMemory.map((proc, i) => (
                <ProcessRow
                  key={`${proc.pid}-${i}`}
                  proc={proc}
                  maxValue={maxMem}
                  color={getBarColor(i)}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ProcessRow({
  proc,
  maxValue,
  color,
}: {
  proc: {
    pid: number
    user: string
    cpuPercent: number
    memPercent: number
    rssBytes: number
    command: string
  }
  maxValue: number
  color: string
}) {
  const barWidth = Math.max((proc.memPercent / maxValue) * 100, 0.5)

  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors">
      <span className="text-[10px] text-muted-foreground tabular-nums w-12 shrink-0 text-right font-mono">
        {proc.pid}
      </span>
      <span
        className="text-sm min-w-0 truncate flex-1 font-mono"
        title={proc.command}
      >
        {shortenCommand(proc.command)}
      </span>
      <span className="text-[10px] text-muted-foreground w-12 shrink-0 text-right">
        {proc.user}
      </span>
      <div className="w-20 shrink-0">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${barWidth}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <span className="text-xs tabular-nums w-12 text-right shrink-0 font-mono font-medium">
        {proc.memPercent.toFixed(1)}%
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums w-14 text-right shrink-0">
        {formatBytes(proc.rssBytes)}
      </span>
    </div>
  )
}
