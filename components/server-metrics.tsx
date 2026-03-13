"use client"

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
  size = 56,
  strokeWidth = 5,
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
        className="fill-foreground text-[11px] font-semibold"
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

  if (loading || !metrics) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Server</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[140px] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Server</CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>up {formatUptime(metrics.uptime)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gauges row */}
        <div className="grid grid-cols-3 gap-4">
          <GaugeItem
            icon={<Cpu className="w-3.5 h-3.5" />}
            label="CPU"
            percent={metrics.cpu.usagePercent}
            detail={`${metrics.cpu.cores} cores`}
          />
          <GaugeItem
            icon={<MemoryStick className="w-3.5 h-3.5" />}
            label="Memory"
            percent={metrics.memory.usagePercent}
            detail={`${formatBytes(metrics.memory.usedBytes)} / ${formatBytes(metrics.memory.totalBytes)}`}
          />
          <GaugeItem
            icon={<HardDrive className="w-3.5 h-3.5" />}
            label="Disk"
            percent={metrics.disk.usagePercent}
            detail={`${formatBytes(metrics.disk.usedBytes)} / ${formatBytes(metrics.disk.totalBytes)}`}
          />
        </div>

        {/* CPU / Memory chart */}
        {history.length > 1 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              CPU &amp; Memory (last {history.length} samples)
            </p>
            <ChartContainer config={chartConfig} className="h-[100px] w-full">
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
                <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
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

        {/* CPU info line */}
        <p className="text-[11px] text-muted-foreground truncate" title={metrics.cpu.model}>
          {metrics.cpu.model} &middot; Load: {metrics.cpu.loadAvg.join(" / ")}
        </p>
      </CardContent>
    </Card>
  )
}

function GaugeItem({
  icon,
  label,
  percent,
  detail,
}: {
  icon: React.ReactNode
  label: string
  percent: number
  detail: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <GaugeRing percent={percent} color={getColor(percent)} />
      <div className="flex items-center gap-1 text-xs font-medium text-foreground">
        {icon}
        {label}
      </div>
      <span className="text-[10px] text-muted-foreground text-center leading-tight">
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
