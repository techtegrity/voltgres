"use client"

import { useState, use } from "react"
import { useQueryLog, useQueryLogDetail, useQueryLogConfig } from "@/hooks/use-query-log"
import { useStatStatements } from "@/hooks/use-stat-statements"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Loader2,
  Activity,
  RefreshCw,
  Settings,
  Server,
  Info,
  RotateCcw,
} from "lucide-react"

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function truncateQuery(query: string, maxLen = 100) {
  if (query.length <= maxLen) return query
  return query.slice(0, maxLen) + "..."
}

function formatMs(ms: number) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function commandBadgeVariant(command: string) {
  switch (command.toUpperCase()) {
    case "SELECT":
      return "secondary" as const
    case "INSERT":
      return "default" as const
    case "UPDATE":
      return "outline" as const
    case "DELETE":
      return "destructive" as const
    case "ERROR":
      return "destructive" as const
    default:
      return "secondary" as const
  }
}

export default function DatabaseActivityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const [tab, setTab] = useState("server")

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Activity
        </h1>
        <p className="text-muted-foreground mt-1">
          Query activity for {dbName}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="server" className="gap-2">
            <Server className="w-4 h-4" />
            Server Queries
          </TabsTrigger>
          <TabsTrigger value="app" className="gap-2">
            <Activity className="w-4 h-4" />
            App Queries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="server">
          <ServerQueriesTab database={dbName} />
        </TabsContent>

        <TabsContent value="app">
          <AppQueriesTab database={dbName} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ── Server Queries (pg_stat_statements) ─────────────────────────────── */

function ServerQueriesTab({ database }: { database: string }) {
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")

  const { entries, available, reason, loading, refresh, reset } = useStatStatements({
    database,
    search,
    autoRefresh: true,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!available) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12">
          <div className="text-center space-y-3">
            <Server className="w-10 h-10 mx-auto text-muted-foreground opacity-50" />
            <div>
              <p className="font-medium text-foreground">
                pg_stat_statements is not available
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {reason === "not_preloaded" ? (
                  <>
                    This extension must be added to <code className="text-xs bg-muted px-1 py-0.5 rounded">shared_preload_libraries</code> in
                    your PostgreSQL configuration file and requires a server restart.
                  </>
                ) : (
                  "Could not install the pg_stat_statements extension. Check your PostgreSQL user permissions."
                )}
              </p>
            </div>
            <div className="pt-2">
              <div className="text-left max-w-sm mx-auto bg-muted/50 rounded-lg p-4 text-xs font-mono space-y-1">
                <p className="text-muted-foreground"># In postgresql.conf:</p>
                <p>shared_preload_libraries = &apos;pg_stat_statements&apos;</p>
                <p className="text-muted-foreground mt-2"># Then restart PostgreSQL</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Info banner */}
      <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <span className="text-muted-foreground">
          Aggregated statistics for <strong>{database}</strong> from all clients — including external apps. Sorted by total execution time.
        </span>
      </div>

      {/* Search + actions */}
      <div className="mb-4 flex gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search queries..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("")
                setSearchInput("")
              }}
            >
              Clear
            </Button>
          )}
        </form>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={reset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset Stats
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {entries.length} query {entries.length === 1 ? "pattern" : "patterns"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No query statistics recorded yet</p>
              <p className="text-xs mt-1">
                Execute queries from any client to see them here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/50">
                    <TableHead>Query</TableHead>
                    <TableHead className="w-[80px]">User</TableHead>
                    <TableHead className="w-[70px] text-right">Calls</TableHead>
                    <TableHead className="w-[90px] text-right">Total Time</TableHead>
                    <TableHead className="w-[80px] text-right">Avg Time</TableHead>
                    <TableHead className="w-[70px] text-right">Rows</TableHead>
                    <TableHead className="w-[90px] text-right">Cache Hit %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <StatStatementRow key={entry.queryid} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function StatStatementRow({
  entry,
}: {
  entry: {
    queryid: string
    query: string
    calls: number
    total_exec_time: number
    mean_exec_time: number
    rows: number
    shared_blks_hit: number
    shared_blks_read: number
    rolname: string | null
  }
}) {
  const [expanded, setExpanded] = useState(false)
  const totalBlocks = entry.shared_blks_hit + entry.shared_blks_read
  const cacheHitPct = totalBlocks > 0 ? ((entry.shared_blks_hit / totalBlocks) * 100).toFixed(1) : "-"

  return (
    <>
      <TableRow
        className="border-border cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="font-mono text-xs max-w-[400px]">
          <span className="break-all">{truncateQuery(entry.query)}</span>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {entry.rolname ?? "-"}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums font-medium">
          {formatNumber(entry.calls)}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatMs(entry.total_exec_time)}
          </span>
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
          {formatMs(entry.mean_exec_time)}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {formatNumber(entry.rows)}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {cacheHitPct !== "-" ? (
            <span className={Number(cacheHitPct) < 90 ? "text-yellow-500" : "text-primary"}>
              {cacheHitPct}%
            </span>
          ) : (
            "-"
          )}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="border-border bg-muted/30">
          <TableCell colSpan={7} className="p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Full Query</p>
              <pre className="p-3 rounded-lg bg-background border border-border text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
                {entry.query}
              </pre>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

/* ── App Queries (SQLite query log) ──────────────────────────────────── */

function AppQueriesTab({ database }: { database: string }) {
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const pageSize = 30

  const { entries, totalCount, loading, refresh } = useQueryLog({
    database,
    search,
    page,
    pageSize,
    autoRefresh: true,
  })
  const { entry: detail, loading: detailLoading } = useQueryLogDetail(expandedId)
  const { config, updateConfig } = useQueryLogConfig(database)

  const totalPages = Math.ceil(totalCount / pageSize)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  return (
    <>
      {/* Config card */}
      <Card className="bg-card border-border mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Logging Settings
          </CardTitle>
          <CardDescription className="text-xs">
            Control app-level query logging for this database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch
                checked={config?.enabled ?? true}
                onCheckedChange={(enabled) => updateConfig({ enabled })}
              />
              <span className="text-sm">
                {config?.enabled !== false ? "Logging enabled" : "Logging disabled"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Retention:</span>
              <Select
                value={String(config?.retentionDays ?? 7)}
                onValueChange={(val) => updateConfig({ retentionDays: parseInt(val) })}
              >
                <SelectTrigger className="w-[120px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info banner */}
      <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <span className="text-muted-foreground">
          App queries show individual executions made through Voltgres. External app queries won&apos;t appear here; check the <strong>Server Queries</strong> tab instead.
        </span>
      </div>

      {/* Search + Refresh */}
      <div className="mb-4 flex gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search queries..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("")
                setSearchInput("")
                setPage(1)
              }}
            >
              Clear
            </Button>
          )}
        </form>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {totalCount.toLocaleString()} {totalCount === 1 ? "query" : "queries"}
            </CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span>
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No query activity recorded yet</p>
              <p className="text-xs mt-1">
                {config?.enabled === false
                  ? "Logging is disabled for this database"
                  : "Queries executed via the SQL Editor or table operations will appear here"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/50">
                    <TableHead className="w-[140px]">Time</TableHead>
                    <TableHead>Query</TableHead>
                    <TableHead className="w-[80px]">Type</TableHead>
                    <TableHead className="w-[80px]">Source</TableHead>
                    <TableHead className="w-[60px] text-right">Rows</TableHead>
                    <TableHead className="w-[80px] text-right">Duration</TableHead>
                    <TableHead className="w-[70px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <AppQueryRow
                      key={entry.id}
                      entry={entry}
                      isExpanded={expandedId === entry.id}
                      detail={expandedId === entry.id ? detail : null}
                      detailLoading={expandedId === entry.id && detailLoading}
                      onToggle={() =>
                        setExpandedId((prev) => (prev === entry.id ? null : entry.id))
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function AppQueryRow({
  entry,
  isExpanded,
  detail,
  detailLoading,
  onToggle,
}: {
  entry: { id: string; query: string; command: string; rowCount: number | null; executionTime: number | null; error: string | null; source: string; createdAt: string }
  isExpanded: boolean
  detail: { columns: string[] | null; resultPreview: Record<string, unknown>[] | null; query: string } | null
  detailLoading: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow
        className="border-border cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <TableCell className="text-xs text-muted-foreground">
          {formatDate(entry.createdAt)}
        </TableCell>
        <TableCell className="font-mono text-xs max-w-[400px]">
          <span className="break-all">{truncateQuery(entry.query)}</span>
        </TableCell>
        <TableCell>
          <Badge variant={commandBadgeVariant(entry.command)} className="text-xs">
            {entry.command}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{entry.source}</TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {entry.rowCount ?? "-"}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
          {entry.executionTime != null ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {entry.executionTime}ms
            </span>
          ) : (
            "-"
          )}
        </TableCell>
        <TableCell>
          {entry.error ? (
            <XCircle className="w-4 h-4 text-destructive" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          )}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="border-border bg-muted/30">
          <TableCell colSpan={7} className="p-4">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading details...
              </div>
            ) : detail ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Full Query</p>
                  <pre className="p-3 rounded-lg bg-background border border-border text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
                    {detail.query}
                  </pre>
                </div>

                {entry.error && (
                  <div>
                    <p className="text-xs font-medium text-destructive mb-1">Error</p>
                    <pre className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-mono whitespace-pre-wrap">
                      {entry.error}
                    </pre>
                  </div>
                )}

                {detail.resultPreview && detail.resultPreview.length > 0 && detail.columns && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Result Preview ({detail.resultPreview.length} of {entry.rowCount} rows)
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-border max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border bg-muted/50">
                            {detail.columns.map((col) => (
                              <TableHead
                                key={col}
                                className="text-muted-foreground font-mono text-xs"
                              >
                                {col}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.resultPreview.map((row, idx) => (
                            <TableRow key={idx} className="border-border">
                              {detail.columns!.map((col) => (
                                <TableCell key={col} className="font-mono text-xs py-1.5">
                                  {String(row[col] ?? "NULL")}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
