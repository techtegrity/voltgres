"use client"

import { useState } from "react"
import { useSystemMetrics, type MetricsSnapshot } from "@/hooks/use-system-metrics"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Cpu, HardDrive, MemoryStick, Clock } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { DiskUsageDialog } from "@/components/disk-usage-dialog"
import { CpuUsageDialog } from "@/components/cpu-usage-dialog"
import { MemoryUsageDialog } from "@/components/memory-usage-dialog"

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
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function GaugeRing({
  percent,
  size = 48,
  strokeWidth = 4.5,
  color,
}: {
  percent: number
  size?: number
  strokeWidth?: number
  color: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/40"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[10px] font-semibold"
      >
        {Math.round(percent)}%
      </text>
    </svg>
  )
}

function getColor(percent: number): string {
  if (percent >= 90) return "hsl(0, 72%, 51%)" // red
  if (percent >= 70) return "hsl(38, 92%, 50%)" // amber
  return "hsl(142, 71%, 45%)" // green
}

const chartConfig = {
  cpuPercent: {
    label: "CPU",
    color: "hsl(217, 91%, 60%)",
  },
  memPercent: {
    label: "Memory",
    color: "hsl(142, 71%, 45%)",
  },
} satisfies ChartConfig

export function ServerMetrics() {
  const { metrics, history, loading } = useSystemMetrics(5000)
  const [diskDialogOpen, setDiskDialogOpen] = useState(false)
  const [cpuDialogOpen, setCpuDialogOpen] = useState(false)
  const [memDialogOpen, setMemDialogOpen] = useState(false)

  if (loading || !metrics) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base">Server</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-[80px] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-0 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Server</CardTitle>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="truncate max-w-[200px] hidden sm:inline" title={metrics.cpu.model}>
                {metrics.cpu.model}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                up {formatUptime(metrics.uptime)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-2">
          <div className="flex items-stretch gap-4">
            {/* Gauges column — compact row */}
            <div className="flex items-center gap-4 shrink-0">
              <button
                type="button"
                onClick={() => setCpuDialogOpen(true)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md transition-colors hover:bg-muted/50 -m-1.5 p-1.5 cursor-pointer"
                title="Click to view CPU processes"
              >
                <GaugeItem
                  icon={<Cpu className="w-3 h-3" />}
                  label="CPU"
                  percent={metrics.cpu.usagePercent}
                  detail={`${metrics.cpu.cores} cores`}
                  clickable
                />
              </button>
              <button
                type="button"
                onClick={() => setMemDialogOpen(true)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md transition-colors hover:bg-muted/50 -m-1.5 p-1.5 cursor-pointer"
                title="Click to view memory breakdown"
              >
                <GaugeItem
                  icon={<MemoryStick className="w-3 h-3" />}
                  label="Mem"
                  percent={metrics.memory.usagePercent}
                  detail={`${formatBytes(metrics.memory.usedBytes)} / ${formatBytes(metrics.memory.totalBytes)}`}
                  clickable
                />
              </button>
              <button
                type="button"
                onClick={() => setDiskDialogOpen(true)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md transition-colors hover:bg-muted/50 -m-1.5 p-1.5 cursor-pointer"
                title="Click to view disk usage breakdown"
              >
                <GaugeItem
                  icon={<HardDrive className="w-3 h-3" />}
                  label="Disk"
                  percent={metrics.disk.usagePercent}
                  detail={`${formatBytes(metrics.disk.usedBytes)} / ${formatBytes(metrics.disk.totalBytes)}`}
                  clickable
                />
              </button>
            </div>

            {/* Divider */}
            <div className="w-px bg-border shrink-0 self-stretch" />

            {/* Chart — fills remaining space */}
            {history.length > 1 && (
              <div className="flex-1 min-w-0">
                <ChartContainer config={chartConfig} className="h-[80px] w-full">
                  <AreaChart data={formatHistory(history)}>
                    <defs>
                      <linearGradient id="fillCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-cpuPercent)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-cpuPercent)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillMem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-memPercent)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-memPercent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} height={0} />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      width={24}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => `${value}%`}
                        />
                      }
                    />
                    <Area
                      dataKey="cpuPercent"
                      type="monotone"
                      fill="url(#fillCpu)"
                      stroke="var(--color-cpuPercent)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Area
                      dataKey="memPercent"
                      type="monotone"
                      fill="url(#fillMem)"
                      stroke="var(--color-memPercent)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CpuUsageDialog open={cpuDialogOpen} onOpenChange={setCpuDialogOpen} />
      <MemoryUsageDialog open={memDialogOpen} onOpenChange={setMemDialogOpen} />
      <DiskUsageDialog open={diskDialogOpen} onOpenChange={setDiskDialogOpen} />
    </>
  )
}

function GaugeItem({
  icon,
  label,
  percent,
  detail,
  clickable,
}: {
  icon: React.ReactNode
  label: string
  percent: number
  detail: string
  clickable?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <GaugeRing percent={percent} color={getColor(percent)} />
      <div className={`flex items-center gap-1 text-[11px] font-medium text-foreground ${clickable ? "underline decoration-dotted underline-offset-2 decoration-muted-foreground/50" : ""}`}>
        {icon}
        {label}
      </div>
      <span className="text-[9px] text-muted-foreground text-center leading-tight">
        {detail}
      </span>
    </div>
  )
}

function formatHistory(history: MetricsSnapshot[]) {
  return history.map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    cpuPercent: h.cpuPercent,
    memPercent: h.memPercent,
  }))
}
