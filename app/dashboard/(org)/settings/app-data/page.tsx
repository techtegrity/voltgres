"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table as TableIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Key,
  EyeOff,
  ArrowLeft,
} from "lucide-react"

type TableInfo = { name: string; rowCount: number }
type ColumnInfo = {
  name: string
  type: string
  notNull: boolean
  primaryKey: boolean
  sensitive: boolean
}
type TableData = {
  table: string
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  totalRows: number
  page: number
  pageSize: number
  totalPages: number
}

export default function AppDataPage() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [tableLoading, setTableLoading] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch("/api/config/app-data")
      .then((r) => r.json())
      .then((data) => setTables(data.tables || []))
      .finally(() => setLoading(false))
  }, [])

  const loadTable = useCallback(
    async (table: string, p: number) => {
      setTableLoading(true)
      try {
        const res = await fetch(
          `/api/config/app-data?table=${encodeURIComponent(table)}&page=${p}&pageSize=50`
        )
        const data = await res.json()
        setTableData(data)
        setPage(p)
      } finally {
        setTableLoading(false)
      }
    },
    []
  )

  const handleSelectTable = (name: string) => {
    setSelectedTable(name)
    setPage(1)
    loadTable(name, 1)
  }

  const handleBack = () => {
    setSelectedTable(null)
    setTableData(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Table detail view
  if (selectedTable && tableData) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-1.5 -ml-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TableIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-mono">{selectedTable}</CardTitle>
                <CardDescription>
                  {tableData.totalRows.toLocaleString()} row{tableData.totalRows !== 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>
            {tableData.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || tableLoading}
                  onClick={() => loadTable(selectedTable, page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {page} / {tableData.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= tableData.totalPages || tableLoading}
                  onClick={() => loadTable(selectedTable, page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tableLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : tableData.rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              This table is empty
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {tableData.columns.map((col) => (
                      <th
                        key={col.name}
                        className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1.5">
                          {col.primaryKey && (
                            <Key className="w-3 h-3 text-amber-500" />
                          )}
                          {col.sensitive && (
                            <EyeOff className="w-3 h-3 text-muted-foreground/60" />
                          )}
                          <span className="font-mono text-xs">{col.name}</span>
                          <span className="text-[10px] text-muted-foreground/50 font-normal">
                            {col.type || "text"}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-border/50 hover:bg-muted/20"
                    >
                      {tableData.columns.map((col) => (
                        <td
                          key={col.name}
                          className="px-3 py-1.5 font-mono text-xs max-w-[300px] truncate"
                        >
                          <CellValue value={row[col.name]} sensitive={col.sensitive} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Table list view
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <TableIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>App Data</CardTitle>
            <CardDescription>
              Browse the SQLite tables powering this Voltgres instance
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {tables.map((t) => (
            <button
              key={t.name}
              onClick={() => handleSelectTable(t.name)}
              className="flex items-center justify-between w-full px-6 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TableIcon className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-sm">{t.name}</span>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {t.rowCount.toLocaleString()} row{t.rowCount !== 1 ? "s" : ""}
              </Badge>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function CellValue({ value, sensitive }: { value: unknown; sensitive: boolean }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/40 italic">null</span>
  }

  if (sensitive && typeof value === "string" && value === "••••••••") {
    return <span className="text-muted-foreground/60">••••••••</span>
  }

  const str = typeof value === "object" ? JSON.stringify(value) : String(value)

  // Render timestamps as human-readable
  if (typeof value === "number" && str.length >= 10 && str.length <= 13) {
    const ms = str.length === 10 ? value * 1000 : value
    const date = new Date(ms as number)
    if (date.getFullYear() >= 2020 && date.getFullYear() <= 2100) {
      return (
        <span title={str}>
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </span>
      )
    }
  }

  return <span title={str}>{str}</span>
}
