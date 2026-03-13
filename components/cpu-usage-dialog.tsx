"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Cpu, Loader2 } from "lucide-react"
import { api, type ProcessesData } from "@/lib/api-client"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function shortenCommand(cmd: string): string {
  // Get just the executable name, not full path or args
  const parts = cmd.split(/\s+/)
  const exec = parts[0]
  const basename = exec.split("/").pop() || exec
  // Include first arg if it's a common wrapper (like python scripts)
  if (["python3", "python", "node", "ruby", "java", "perl"].includes(basename) && parts[1]) {
    const scriptName = parts[1].split("/").pop() || parts[1]
    return `${basename} ${scriptName}`
  }
  return basename
}

const BAR_COLORS = [
  "hsl(0, 72%, 51%)",    // red (highest)
  "hsl(15, 85%, 52%)",   // red-orange
  "hsl(25, 90%, 52%)",   // orange
  "hsl(38, 92%, 50%)",   // amber
  "hsl(45, 90%, 48%)",   // yellow-amber
  "hsl(142, 71%, 45%)",  // green (rest)
]

function getBarColor(index: number): string {
  if (index < BAR_COLORS.length - 1) return BAR_COLORS[index]
  return BAR_COLORS[BAR_COLORS.length - 1]
}

export function CpuUsageDialog({
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

  // Find the max CPU% for scaling bars
  const maxCpu = data
    ? Math.max(...data.topByCpu.map((p) => p.cpuPercent), 1)
    : 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            CPU Usage
          </DialogTitle>
          <DialogDescription>
            Top processes by CPU utilization
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-destructive text-sm py-4">
            Failed to load process info: {error}
          </div>
        )}

        {data && !loading && (
          <div className="space-y-5">
            {/* CPU info summary */}
            <div className="flex items-center gap-3 rounded-md bg-muted/50 border border-border px-3 py-2">
              <Cpu className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" title={data.cpuInfo.model}>
                  {data.cpuInfo.model || "Unknown CPU"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.cpuInfo.cores} cores
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono tabular-nums">
                  Load: {data.cpuInfo.loadAvg.map((l) => l.toFixed(2)).join(" / ")}
                </div>
                <div className="text-xs text-muted-foreground">1m / 5m / 15m</div>
              </div>
            </div>

            {/* Process list */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Top processes
                </p>
              </div>
              {data.topByCpu.map((proc, i) => (
                <ProcessRow
                  key={`${proc.pid}-${i}`}
                  proc={proc}
                  valueKey="cpuPercent"
                  maxValue={maxCpu}
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
  valueKey,
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
  valueKey: "cpuPercent" | "memPercent"
  maxValue: number
  color: string
}) {
  const value = proc[valueKey]
  const barWidth = Math.max((value / maxValue) * 100, 0.5)

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
        {value.toFixed(1)}%
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums w-14 text-right shrink-0">
        {formatBytes(proc.rssBytes)}
      </span>
    </div>
  )
}
