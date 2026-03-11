"use client"

import { useState, use } from "react"
import { api, type QueryResult } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  Sparkles,
} from "lucide-react"

export default function DatabaseSQLPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)

  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users LIMIT 10;")
  const [isExecuting, setIsExecuting] = useState(false)
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [queryHistory, setQueryHistory] = useState<string[]>([
    "SELECT * FROM users LIMIT 10;",
    "SELECT COUNT(*) FROM posts;",
  ])

  const executeQuery = async () => {
    setIsExecuting(true)
    setQueryError(null)
    setQueryResult(null)

    if (!queryHistory.includes(sqlQuery)) {
      setQueryHistory((prev) => [sqlQuery, ...prev.slice(0, 9)])
    }

    try {
      const result = await api.sql.execute(dbName, sqlQuery)
      setQueryResult(result)
    } catch (err) {
      setQueryError((err as Error).message)
    } finally {
      setIsExecuting(false)
    }
  }

  const exampleQueries = [
    { label: "Select all", query: "SELECT * FROM users LIMIT 100;" },
    { label: "Count rows", query: "SELECT COUNT(*) FROM users;" },
    { label: "Show tables", query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" },
    { label: "Table info", query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';" },
  ]

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">SQL Editor</h1>
        <p className="text-muted-foreground mt-1">
          Run SQL queries against {dbName}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Query Editor */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Query</CardTitle>
                <div className="flex items-center gap-1">
                  {exampleQueries.map((eq) => (
                    <Button
                      key={eq.label}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setSqlQuery(eq.query)}
                    >
                      {eq.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      executeQuery()
                    }
                  }}
                  className="w-full h-32 p-4 rounded-lg bg-muted border border-border font-mono text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your SQL query..."
                  spellCheck={false}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Ctrl+Enter to execute
                  </p>
                  <Button onClick={executeQuery} disabled={isExecuting || !sqlQuery.trim()} className="gap-2">
                    {isExecuting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Run Query
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {(queryResult || queryError) && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {queryError ? (
                      <>
                        <XCircle className="w-4 h-4 text-destructive" />
                        Error
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        Results
                      </>
                    )}
                  </CardTitle>
                  {queryResult && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{queryResult.rowCount} row{queryResult.rowCount !== 1 ? "s" : ""}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {queryResult.executionTime}ms
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {queryError ? (
                  <pre className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm font-mono whitespace-pre-wrap">
                    {queryError}
                  </pre>
                ) : queryResult && queryResult.columns.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border bg-muted/50">
                          {queryResult.columns.map((col) => (
                            <TableHead key={col} className="text-muted-foreground font-mono text-xs">
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryResult.rows.map((row, idx) => (
                          <TableRow key={idx} className="border-border">
                            {queryResult.columns.map((col) => (
                              <TableCell key={col} className="font-mono text-sm py-2">
                                {String(row[col] ?? "NULL")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Query executed successfully. {queryResult?.rowCount} row(s) affected.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - History */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="w-4 h-4" />
                Recent Queries
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {queryHistory.map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSqlQuery(query)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <code className="text-xs font-mono text-muted-foreground line-clamp-2">
                      {query}
                    </code>
                  </button>
                ))}
                {queryHistory.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No query history
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
