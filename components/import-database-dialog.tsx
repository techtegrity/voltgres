"use client"

import { useState, useCallback, useRef } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  ArrowLeft,
  ArrowRight,
  Database,
  AlertTriangle,
  Search,
  Link,
  Settings2,
} from "lucide-react"

interface ConnectionConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  ssl: boolean
}

type ConnectionInputMode = "string" | "fields"

function parseConnectionString(str: string): Partial<ConnectionConfig> {
  const s = str.trim()
  if (!s) return {}

  try {
    const url = new URL(s.startsWith("postgres") ? s : `postgresql://${s}`)
    return {
      host: url.hostname || undefined,
      port: url.port ? parseInt(url.port, 10) : 5432,
      user: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      database: url.pathname.replace(/^\//, "") || undefined,
      ssl: url.searchParams.get("sslmode") === "require" ||
        url.searchParams.get("ssl") === "true" ||
        url.searchParams.get("sslmode") === "verify-full" ||
        url.searchParams.get("sslmode") === "verify-ca",
    }
  } catch {
    // Try key=value format: host=... port=... user=... password=... dbname=...
    const parts: Record<string, string> = {}
    for (const match of s.matchAll(/(\w+)\s*=\s*(?:'([^']*)'|(\S+))/g)) {
      parts[match[1]] = match[2] ?? match[3]
    }
    if (Object.keys(parts).length === 0) return {}
    return {
      host: parts.host || parts.hostname,
      port: parts.port ? parseInt(parts.port, 10) : 5432,
      user: parts.user || parts.username,
      password: parts.password,
      database: parts.dbname || parts.database,
      ssl: parts.sslmode === "require" || parts.sslmode === "verify-full" || parts.sslmode === "verify-ca",
    }
  }
}


interface ExternalTable {
  schema: string
  name: string
  rowCount: number
  sizeBytes: number
}

interface TableProgress {
  schema: string
  table: string
  phase: string
  rowsImported: number
  totalRows: number
  error?: string
  done: boolean
}

interface ImportDatabaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetDatabase: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatNumber(n: number): string {
  if (n < 0) return "~0"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function ImportDatabaseDialog({
  open,
  onOpenChange,
  targetDatabase,
}: ImportDatabaseDialogProps) {
  const [step, setStep] = useState(1)

  // Step 1: Connection
  const [inputMode, setInputMode] = useState<ConnectionInputMode>("string")
  const [connectionString, setConnectionString] = useState("")
  const [conn, setConn] = useState<ConnectionConfig>({
    host: "",
    port: 5432,
    user: "postgres",
    password: "",
    database: "",
    ssl: false,
  })
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testMessage, setTestMessage] = useState("")

  // Step 2: Table selection
  const [tables, setTables] = useState<ExternalTable[]>([])
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set())
  const [tableFilter, setTableFilter] = useState("")
  const [tablesLoading, setTablesLoading] = useState(false)
  const [tablesError, setTablesError] = useState("")

  // Step 3: Target
  const [targetMode, setTargetMode] = useState<"existing" | "new">("existing")
  const [newDbName, setNewDbName] = useState("")

  // Step 4: Progress
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [tableProgress, setTableProgress] = useState<Map<string, TableProgress>>(new Map())
  const [importSummary, setImportSummary] = useState<{
    imported: number
    failed: number
    totalRowsImported: number
    fkErrors: number
  } | null>(null)
  const [importError, setImportError] = useState("")
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setStep(1)
    setInputMode("string")
    setConnectionString("")
    setConn({ host: "", port: 5432, user: "postgres", password: "", database: "", ssl: false })
    setTestStatus("idle")
    setTestMessage("")
    setTables([])
    setSelectedTables(new Set())
    setTableFilter("")
    setTablesLoading(false)
    setTablesError("")
    setTargetMode("existing")
    setNewDbName("")
    setImporting(false)
    setImportDone(false)
    setTableProgress(new Map())
    setImportSummary(null)
    setImportError("")
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) reset()
      onOpenChange(open)
    },
    [onOpenChange, reset]
  )

  // Resolve connection config from either input mode
  const getResolvedConnection = useCallback((): ConnectionConfig => {
    if (inputMode === "string") {
      const parsed = parseConnectionString(connectionString)
      return {
        host: parsed.host || "",
        port: parsed.port || 5432,
        user: parsed.user || "postgres",
        password: parsed.password || "",
        database: parsed.database || "",
        ssl: parsed.ssl || false,
      }
    }
    return conn
  }, [inputMode, connectionString, conn])

  const isConnectionValid = useCallback((): boolean => {
    const c = getResolvedConnection()
    return !!(c.host && c.database && c.user)
  }, [getResolvedConnection])

  // Step 1: Test connection
  const handleTestConnection = async () => {
    setTestStatus("testing")
    setTestMessage("")
    try {
      const resolved = getResolvedConnection()
      const result = await api.import.testConnection(resolved)
      if (result.success) {
        setTestStatus("success")
        setTestMessage(result.version || "Connected successfully")
      } else {
        setTestStatus("error")
        setTestMessage(result.error || "Connection failed")
      }
    } catch (error) {
      setTestStatus("error")
      setTestMessage((error as Error).message)
    }
  }

  // Step 1 -> 2: Load tables
  const handleLoadTables = async () => {
    setTablesLoading(true)
    setTablesError("")
    try {
      const resolved = getResolvedConnection()
      const result = await api.import.listTables(resolved)
      // Sync conn state so step 4 import uses the resolved values
      setConn(resolved)
      setTables(result)
      setSelectedTables(new Set(result.map((t) => `${t.schema}.${t.name}`)))
      setStep(2)
    } catch (error) {
      setTablesError((error as Error).message)
    } finally {
      setTablesLoading(false)
    }
  }

  // Table selection helpers
  const filteredTables = tables.filter((t) => {
    if (!tableFilter) return true
    const q = tableFilter.toLowerCase()
    return t.name.toLowerCase().includes(q) || t.schema.toLowerCase().includes(q)
  })

  const toggleTable = (key: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedTables.size === filteredTables.length) {
      setSelectedTables(new Set())
    } else {
      setSelectedTables(new Set(filteredTables.map((t) => `${t.schema}.${t.name}`)))
    }
  }

  const selectedTablesList = tables.filter((t) => selectedTables.has(`${t.schema}.${t.name}`))
  const totalSelectedRows = selectedTablesList.reduce((sum, t) => sum + t.rowCount, 0)

  // Step 4: Execute import
  const handleStartImport = async () => {
    setStep(4)
    setImporting(true)
    setImportDone(false)
    setImportError("")
    setImportSummary(null)

    const initialProgress = new Map<string, TableProgress>()
    for (const t of selectedTablesList) {
      initialProgress.set(`${t.schema}.${t.name}`, {
        schema: t.schema,
        table: t.name,
        phase: "pending",
        rowsImported: 0,
        totalRows: t.rowCount,
        done: false,
      })
    }
    setTableProgress(initialProgress)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch("/api/pg/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: conn,
          tables: selectedTablesList.map((t) => ({ schema: t.schema, name: t.name })),
          target: {
            mode: targetMode,
            database: targetMode === "existing" ? targetDatabase : undefined,
            newDatabaseName: targetMode === "new" ? newDbName : undefined,
          },
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Import request failed" }))
        throw new Error(body.error || "Import request failed")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const data = JSON.parse(line.slice(6))
            handleSSEEvent(data)
          } catch {
            // skip malformed lines
          }
        }
      }

      // Process any remaining buffer
      if (buffer.startsWith("data: ")) {
        try {
          const data = JSON.parse(buffer.slice(6))
          handleSSEEvent(data)
        } catch {
          // skip
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setImportError((error as Error).message)
      }
    } finally {
      setImporting(false)
      setImportDone(true)
    }
  }

  const handleSSEEvent = (data: Record<string, unknown>) => {
    switch (data.type) {
      case "progress": {
        const key = `${data.schema}.${data.table}`
        setTableProgress((prev) => {
          const next = new Map(prev)
          next.set(key, {
            schema: data.schema as string,
            table: data.table as string,
            phase: data.phase as string,
            rowsImported: data.rowsImported as number,
            totalRows: data.totalRows as number,
            done: false,
          })
          return next
        })
        break
      }
      case "table_complete": {
        const key = `${data.schema}.${data.table}`
        setTableProgress((prev) => {
          const next = new Map(prev)
          const existing = next.get(key)
          if (existing) {
            next.set(key, { ...existing, phase: "done", done: true })
          }
          return next
        })
        break
      }
      case "table_error": {
        const key = `${data.schema}.${data.table}`
        setTableProgress((prev) => {
          const next = new Map(prev)
          const existing = next.get(key)
          if (existing) {
            next.set(key, {
              ...existing,
              phase: "error",
              error: data.error as string,
              done: true,
            })
          }
          return next
        })
        break
      }
      case "complete":
        setImportSummary(
          data.summary as {
            imported: number
            failed: number
            totalRowsImported: number
            fkErrors: number
          }
        )
        break
      case "error":
        setImportError(data.message as string)
        break
    }
  }

  const completedTables = Array.from(tableProgress.values()).filter((t) => t.done && t.phase === "done").length
  const failedTables = Array.from(tableProgress.values()).filter((t) => t.phase === "error").length
  const totalTables = tableProgress.size
  const overallProgress = totalTables > 0 ? ((completedTables + failedTables) / totalTables) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Import Database
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Connect to an external PostgreSQL database to import tables and data."}
            {step === 2 && "Select which tables to import."}
            {step === 3 && "Choose where to import the data."}
            {step === 4 && "Importing tables and data..."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Connection */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto">
            {/* Input mode toggle */}
            <div className="flex gap-1 p-1 mb-4 bg-muted rounded-lg w-fit">
              <button
                type="button"
                onClick={() => {
                  setInputMode("string")
                  setTestStatus("idle")
                  setTestMessage("")
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  inputMode === "string"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link className="w-3.5 h-3.5" />
                Connection String
              </button>
              <button
                type="button"
                onClick={() => {
                  // When switching to fields, populate from connection string if available
                  if (inputMode === "string" && connectionString) {
                    const parsed = parseConnectionString(connectionString)
                    setConn((c) => ({
                      host: parsed.host || c.host,
                      port: parsed.port || c.port,
                      user: parsed.user || c.user,
                      password: parsed.password ?? c.password,
                      database: parsed.database || c.database,
                      ssl: parsed.ssl ?? c.ssl,
                    }))
                  }
                  setInputMode("fields")
                  setTestStatus("idle")
                  setTestMessage("")
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  inputMode === "fields"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                Individual Fields
              </button>
            </div>

            {inputMode === "string" ? (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="import-connstring">Connection String</FieldLabel>
                  <textarea
                    id="import-connstring"
                    value={connectionString}
                    onChange={(e) => {
                      setConnectionString(e.target.value)
                      setTestStatus("idle")
                      setTestMessage("")
                    }}
                    placeholder="postgresql://user:password@host:5432/database?sslmode=require"
                    rows={3}
                    className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste a connection string from Neon, Supabase, Coolify, Railway, or any PostgreSQL provider.
                  </p>
                </Field>
              </FieldGroup>
            ) : (
              <FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="import-host">Host</FieldLabel>
                    <Input
                      id="import-host"
                      value={conn.host}
                      onChange={(e) => setConn((c) => ({ ...c, host: e.target.value }))}
                      placeholder="db.example.com"
                      className="bg-input border-border"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="import-port">Port</FieldLabel>
                    <Input
                      id="import-port"
                      type="number"
                      value={conn.port}
                      onChange={(e) => setConn((c) => ({ ...c, port: parseInt(e.target.value) || 5432 }))}
                      className="bg-input border-border"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="import-user">Username</FieldLabel>
                    <Input
                      id="import-user"
                      value={conn.user}
                      onChange={(e) => setConn((c) => ({ ...c, user: e.target.value }))}
                      placeholder="postgres"
                      className="bg-input border-border"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="import-password">Password</FieldLabel>
                    <Input
                      id="import-password"
                      type="password"
                      value={conn.password}
                      onChange={(e) => setConn((c) => ({ ...c, password: e.target.value }))}
                      className="bg-input border-border"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="import-database">Database</FieldLabel>
                  <Input
                    id="import-database"
                    value={conn.database}
                    onChange={(e) => setConn((c) => ({ ...c, database: e.target.value }))}
                    placeholder="techtegrity"
                    className="bg-input border-border"
                  />
                </Field>
                <Field orientation="horizontal">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="import-ssl"
                      checked={conn.ssl}
                      onCheckedChange={(checked) => setConn((c) => ({ ...c, ssl: checked }))}
                    />
                    <Label htmlFor="import-ssl" className="text-sm">
                      Use SSL
                    </Label>
                  </div>
                </Field>
              </FieldGroup>
            )}

            {testStatus === "success" && (
              <div className="mt-4 p-3 rounded-lg bg-chart-2/10 border border-chart-2/20 text-sm text-chart-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">{testMessage}</span>
              </div>
            )}
            {testStatus === "error" && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{testMessage}</span>
              </div>
            )}
            {tablesError && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{tablesError}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Table Selection */}
        {step === 2 && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  placeholder="Filter tables..."
                  className="pl-9 bg-input border-border"
                />
              </div>
              <Badge variant="secondary" className="shrink-0">
                {selectedTables.size} / {tables.length} selected
              </Badge>
            </div>

            <div className="flex items-center gap-2 mb-2 px-1">
              <Checkbox
                id="select-all"
                checked={filteredTables.length > 0 && selectedTables.size === filteredTables.length}
                onCheckedChange={toggleAll}
              />
              <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select all
              </Label>
            </div>

            <ScrollArea className="flex-1 max-h-[340px] border border-border rounded-lg">
              <div className="divide-y divide-border">
                {filteredTables.map((t) => {
                  const key = `${t.schema}.${t.name}`
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedTables.has(key)}
                        onCheckedChange={() => toggleTable(key)}
                      />
                      <span className="flex-1 text-sm font-mono truncate">
                        {t.schema !== "public" && (
                          <span className="text-muted-foreground">{t.schema}.</span>
                        )}
                        {t.name}
                      </span>
                      <Badge variant="outline" className="shrink-0 font-mono text-xs">
                        {formatNumber(t.rowCount)} rows
                      </Badge>
                      <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                        {formatBytes(t.sizeBytes)}
                      </Badge>
                    </label>
                  )
                })}
                {filteredTables.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    {tables.length === 0 ? "No tables found in this database" : "No tables match your filter"}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Step 3: Target Config */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto">
            <RadioGroup
              value={targetMode}
              onValueChange={(v) => setTargetMode(v as "existing" | "new")}
              className="space-y-3"
            >
              <label className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 cursor-pointer has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="existing" id="target-existing" className="mt-0.5" />
                <div>
                  <Label htmlFor="target-existing" className="font-medium cursor-pointer">
                    Import into current database
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Import tables into <span className="font-mono font-medium text-foreground">{targetDatabase}</span>
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 cursor-pointer has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="new" id="target-new" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="target-new" className="font-medium cursor-pointer">
                    Create a new database
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1 mb-2">
                    Create a fresh database and import tables into it
                  </p>
                  {targetMode === "new" && (
                    <Input
                      value={newDbName}
                      onChange={(e) => setNewDbName(e.target.value)}
                      placeholder="new_database_name"
                      className="bg-input border-border font-mono text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              </label>
            </RadioGroup>

            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm font-medium">Import Summary</p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedTables.size} tables &bull; ~{formatNumber(totalSelectedRows)} total rows
              </p>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-chart-4/10 border border-chart-4/20 text-sm text-chart-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Tables with the same name in the target database will be skipped.
              </span>
            </div>
          </div>
        )}

        {/* Step 4: Progress */}
        {step === 4 && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {importDone
                    ? importSummary
                      ? `${importSummary.imported} imported, ${importSummary.failed} failed`
                      : "Import finished"
                    : `Importing... ${completedTables} / ${totalTables} tables`}
                </span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(overallProgress)}%
                </span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>

            {importError && (
              <div className="mb-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <ScrollArea className="flex-1 max-h-[340px]">
              <div className="space-y-1">
                {Array.from(tableProgress.values()).map((tp) => {
                  const key = `${tp.schema}.${tp.table}`
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    >
                      {tp.phase === "pending" && (
                        <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      {tp.phase === "done" && (
                        <CheckCircle2 className="w-4 h-4 text-chart-2 shrink-0" />
                      )}
                      {tp.phase === "error" && (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      {!["pending", "done", "error"].includes(tp.phase) && (
                        <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-mono truncate block">
                          {tp.schema !== "public" && (
                            <span className="text-muted-foreground">{tp.schema}.</span>
                          )}
                          {tp.table}
                        </span>
                        {tp.phase === "error" && tp.error && (
                          <span className="text-xs text-destructive truncate block">
                            {tp.error}
                          </span>
                        )}
                      </div>

                      <span className="text-xs text-muted-foreground shrink-0">
                        {tp.phase === "schema" && "Creating table..."}
                        {tp.phase === "data" &&
                          `${formatNumber(tp.rowsImported)} / ${formatNumber(tp.totalRows)} rows`}
                        {tp.phase === "indexes" && "Creating indexes..."}
                        {tp.phase === "sequences" && "Resetting sequences..."}
                        {tp.phase === "done" && (
                          <span className="text-chart-2">{formatNumber(tp.rowsImported)} rows</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="gap-2 sm:gap-0">
          {step === 1 && (
            <>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={!isConnectionValid() || testStatus === "testing"}
                className="gap-2"
              >
                {testStatus === "testing" && <Loader2 className="w-4 h-4 animate-spin" />}
                Test Connection
              </Button>
              <Button
                onClick={handleLoadTables}
                disabled={testStatus !== "success" || tablesLoading}
                className="gap-2"
              >
                {tablesLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={selectedTables.size === 0}
                className="gap-2"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleStartImport}
                disabled={targetMode === "new" && !newDbName}
                className="gap-2"
              >
                Start Import
              </Button>
            </>
          )}
          {step === 4 && (
            <Button
              variant={importDone ? "default" : "outline"}
              onClick={() => handleOpenChange(false)}
              disabled={importing}
            >
              {importDone ? "Close" : "Cancel"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
