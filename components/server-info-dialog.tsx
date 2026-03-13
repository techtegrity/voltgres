"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Server, Cpu, MemoryStick, HardDrive, Clock, Activity } from "lucide-react"
import type { SystemMetrics } from "@/lib/api-client"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d} day${d !== 1 ? "s" : ""}`)
  if (h > 0) parts.push(`${h} hour${h !== 1 ? "s" : ""}`)
  if (m > 0) parts.push(`${m} min`)
  return parts.join(", ") || "< 1 min"
}

export function ServerInfoDialog({
  open,
  onOpenChange,
  metrics,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  metrics: SystemMetrics
}) {
  const rows: { icon: React.ReactNode; label: string; value: string }[] = [
    {
      icon: <Cpu className="w-4 h-4 text-blue-400" />,
      label: "Processor",
      value: metrics.cpu.model || "Unknown",
    },
    {
      icon: <Cpu className="w-4 h-4 text-blue-400" />,
      label: "CPU cores",
      value: String(metrics.cpu.cores),
    },
    {
      icon: <Activity className="w-4 h-4 text-amber-400" />,
      label: "Load average",
      value: metrics.cpu.loadAvg.map((l) => l.toFixed(2)).join("  /  "),
    },
    {
      icon: <Cpu className="w-4 h-4 text-blue-400" />,
      label: "CPU usage",
      value: `${metrics.cpu.usagePercent}%`,
    },
    {
      icon: <MemoryStick className="w-4 h-4 text-green-400" />,
      label: "Memory",
      value: `${formatBytes(metrics.memory.usedBytes)} / ${formatBytes(metrics.memory.totalBytes)} (${metrics.memory.usagePercent}%)`,
    },
    {
      icon: <HardDrive className="w-4 h-4 text-amber-400" />,
      label: "Disk",
      value: `${formatBytes(metrics.disk.usedBytes)} / ${formatBytes(metrics.disk.totalBytes)} (${metrics.disk.usagePercent}%)`,
    },
    {
      icon: <HardDrive className="w-4 h-4 text-amber-400" />,
      label: "Mount point",
      value: metrics.disk.mountPoint,
    },
    {
      icon: <Clock className="w-4 h-4 text-muted-foreground" />,
      label: "Uptime",
      value: formatUptime(metrics.uptime),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Server Information
          </DialogTitle>
          <DialogDescription>
            System details for this VPS
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40 transition-colors"
            >
              <div className="shrink-0">{row.icon}</div>
              <span className="text-sm text-muted-foreground w-28 shrink-0">
                {row.label}
              </span>
              <span className="text-sm font-medium min-w-0 truncate" title={row.value}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
