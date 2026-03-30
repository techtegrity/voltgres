"use client"

import { useState, useEffect, use } from "react"
import { useTables } from "@/hooks/use-tables"
import { useDatabases } from "@/hooks/use-databases"
import { usePgUsers } from "@/hooks/use-pg-users"
import { useConnection } from "@/hooks/use-connection"
import { useKnownPasswords } from "@/hooks/use-known-passwords"
import { useActivity } from "@/hooks/use-activity"
import { useConnectionHistory } from "@/hooks/use-connection-history"
import { api, type DatabaseRow } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConnectionModal } from "@/components/connection-modal"
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
import {
  Database,
  Link,
  Table2,
  Users,
  HardDrive,
  Activity,
  Zap,
  RefreshCw,
  XCircle,
  Wifi,
} from "lucide-react"

const connectionChartConfig = {
  total: {
    label: "Total",
    color: "hsl(217, 91%, 60%)",
  },
  active: {
    label: "Active",
    color: "hsl(142, 71%, 45%)",
  },
  idle: {
    label: "Idle",
    color: "hsl(38, 92%, 50%)",
  },
} satisfies ChartConfig

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function formatDuration(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "-"
  const diff = Date.now() - new Date(isoTimestamp).getTime()
  if (diff < 0) return "just now"
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function stateColor(state: string | null): string {
  switch (state) {
    case "active": return "bg-green-500/15 text-green-400 border-green-500/30"
    case "idle": return "bg-muted text-muted-foreground border-border"
    case "idle in transaction": return "bg-orange-500/15 text-orange-400 border-orange-500/30"
    case "idle in transaction (aborted)": return "bg-red-500/15 text-red-400 border-red-500/30"
    case "fastpath function call": return "bg-blue-500/15 text-blue-400 border-blue-500/30"
    case "disabled": return "bg-muted text-muted-foreground border-border"
    default: return "bg-muted text-muted-foreground border-border"
  }
}

export default function DatabaseDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const { tables } = useTables(dbName)
  const { databases } = useDatabases()
  const { users, refresh: refreshUsers } = usePgUsers(dbName)
  const { config } = useConnection()
  const { passwords: knownPasswords, setPassword: setKnownPassword } = useKnownPasswords()
  const { connections, loading: activityLoading, refresh: refreshActivity, terminateConnection } = useActivity(dbName)
  const { history: connectionHistory } = useConnectionHistory(dbName)
  const [connectionModalOpen, setConnectionModalOpen] = useState(false)
  const [terminatingPid, setTerminatingPid] = useState<number | null>(null)
  const [dbInfo, setDbInfo] = useState<DatabaseRow | null>(null)

  useEffect(() => {
    api.databases.get(dbName).then(setDbInfo).catch(() => {})
  }, [dbName])

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-mono">{dbName}</h1>
            <p className="text-sm text-muted-foreground">
              Owner: {dbInfo?.owner ?? "..."} &bull; {dbInfo?.encoding ?? "..."}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <HardDrive className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatBytes(dbInfo?.size_bytes ?? 0)}</p>
                <p className="text-sm text-muted-foreground">Storage</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-chart-2/10">
                <Table2 className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{tables.length}</p>
                <p className="text-sm text-muted-foreground">Tables</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-chart-3/10">
                <Users className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{users.length}</p>
                <p className="text-sm text-muted-foreground">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-chart-4/10">
                <Wifi className="w-5 h-5 text-chart-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{connections.length}</p>
                <p className="text-sm text-muted-foreground">Connections</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Connection
              </CardTitle>
              <CardDescription>
                Get connection details for your application
              </CardDescription>
            </div>
            <Button className="gap-2" onClick={() => setConnectionModalOpen(true)}>
              <Link className="w-4 h-4" />
              Connect
            </Button>
          </div>
        </CardHeader>
      </Card>

      <ConnectionModal
        open={connectionModalOpen}
        onOpenChange={setConnectionModalOpen}
        databases={databases}
        users={users}
        initialDatabase={dbName}
        adminUsername={config?.username}
        knownPasswords={knownPasswords}
        onUsersRefresh={refreshUsers}
        onPasswordReset={(username, password) =>
          setKnownPassword(username, password)
        }
      />

      {/* Database Details */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <CardTitle className="text-base">Database Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center justify-between py-2 sm:flex-col sm:items-start sm:gap-1">
              <span className="text-muted-foreground text-sm">Encoding</span>
              <span className="text-foreground font-medium">{dbInfo?.encoding ?? "..."}</span>
            </div>
            <div className="flex items-center justify-between py-2 sm:flex-col sm:items-start sm:gap-1">
              <span className="text-muted-foreground text-sm">Owner</span>
              <span className="text-foreground font-medium">{dbInfo?.owner ?? "..."}</span>
            </div>
            <div className="flex items-center justify-between py-2 sm:flex-col sm:items-start sm:gap-1">
              <span className="text-muted-foreground text-sm">Collation</span>
              <span className="text-foreground font-medium">{dbInfo?.collation ?? "..."}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connections Over Time */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-chart-4" />
            Connections Over Time
          </CardTitle>
          <CardDescription>
            Live connection count sampled every 10 seconds
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectionHistory.length < 2 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Activity className="w-6 h-6 mx-auto mb-2 opacity-50 animate-pulse" />
              <p className="text-sm">Collecting data&hellip; chart will appear shortly</p>
            </div>
          ) : (
            <ChartContainer config={connectionChartConfig} className="h-[200px] w-full">
              <AreaChart data={connectionHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  allowDecimals={false}
                  width={30}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(217, 91%, 60%)"
                  fill="url(#fillTotal)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="active"
                  stroke="hsl(142, 71%, 45%)"
                  fill="url(#fillActive)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Active Connections */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-chart-4" />
                Active Connections
                <span className="text-xs font-normal text-muted-foreground">
                  auto-refreshes every 5s
                </span>
              </CardTitle>
              <CardDescription>
                Live view of all connections to this database via pg_stat_activity
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={refreshActivity}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activityLoading && connections.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 opacity-50 animate-spin" />
              <p className="text-sm">Loading connections...</p>
            </div>
          ) : connections.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Wifi className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active connections</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2.5 px-6 font-medium">PID</th>
                    <th className="text-left py-2.5 px-4 font-medium">User</th>
                    <th className="text-left py-2.5 px-4 font-medium hidden sm:table-cell">Application</th>
                    <th className="text-left py-2.5 px-4 font-medium hidden md:table-cell">Client</th>
                    <th className="text-left py-2.5 px-4 font-medium">State</th>
                    <th className="text-left py-2.5 px-4 font-medium hidden lg:table-cell">Duration</th>
                    <th className="text-left py-2.5 px-4 font-medium hidden xl:table-cell">Query</th>
                    <th className="text-right py-2.5 px-6 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((conn) => (
                    <tr key={conn.pid} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-6 font-mono text-xs text-muted-foreground">{conn.pid}</td>
                      <td className="py-2.5 px-4 text-foreground">{conn.usename ?? "-"}</td>
                      <td className="py-2.5 px-4 text-muted-foreground hidden sm:table-cell truncate max-w-[150px]">
                        {conn.application_name || "-"}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground hidden md:table-cell">
                        {conn.client_addr || "local"}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${stateColor(conn.state)}`}>
                          {conn.state === "active" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          )}
                          {conn.state ?? "unknown"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs hidden lg:table-cell" title={conn.backend_start ?? ""}>
                        {formatDuration(conn.backend_start)}
                      </td>
                      <td className="py-2.5 px-4 hidden xl:table-cell max-w-[300px]">
                        {conn.query && conn.state === "active" ? (
                          <code className="text-xs text-foreground/80 bg-muted px-1.5 py-0.5 rounded truncate block">
                            {conn.query}
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-6 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                          title="Terminate connection"
                          disabled={terminatingPid === conn.pid}
                          onClick={async () => {
                            setTerminatingPid(conn.pid)
                            try {
                              await terminateConnection(conn.pid)
                            } finally {
                              setTerminatingPid(null)
                            }
                          }}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
