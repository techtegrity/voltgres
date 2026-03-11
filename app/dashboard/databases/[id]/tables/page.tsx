"use client"

import { useState, useEffect, use } from "react"
import { useTables } from "@/hooks/use-tables"
import { type ColumnRow } from "@/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Table2, Columns3, Hash, Key } from "lucide-react"

function formatNumber(num: number) {
  return new Intl.NumberFormat("en-US").format(num)
}

export default function DatabaseTablesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const { tables, loading, getColumns } = useTables(dbName)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [columns, setColumns] = useState<ColumnRow[]>([])

  useEffect(() => {
    if (selectedTable) {
      const table = tables.find((t) => t.name === selectedTable)
      if (table) {
        getColumns(table.schema, table.name).then(setColumns).catch(() => setColumns([]))
      }
    } else {
      setColumns([])
    }
  }, [selectedTable, tables, getColumns])

  const selectedTableData = tables.find((t) => t.name === selectedTable)

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Tables</h1>
        <p className="text-muted-foreground mt-1">
          Browse and manage tables in {dbName}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tables List */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Schema: public</CardTitle>
            <CardDescription>{tables.length} tables</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => setSelectedTable(selectedTable === table.name ? null : table.name)}
                  className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                    selectedTable === table.name ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Table2 className="w-4 h-4 text-primary" />
                      <span className="font-mono text-sm text-foreground">{table.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {formatNumber(table.row_count)} rows
                    </Badge>
                  </div>
                </button>
              ))}
              {tables.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                  {loading ? "Loading tables..." : "No tables found in this database"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table Details */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-3">
            {selectedTableData ? (
              <>
                <div className="flex items-center gap-2">
                  <Table2 className="w-5 h-5 text-primary" />
                  <CardTitle className="font-mono">{selectedTableData.name}</CardTitle>
                </div>
                <CardDescription className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {formatNumber(selectedTableData.row_count)} rows
                  </span>
                  <span className="flex items-center gap-1">
                    <Columns3 className="w-3 h-3" />
                    {columns.length} columns
                  </span>
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle>Select a table</CardTitle>
                <CardDescription>Choose a table from the list to view its schema</CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {selectedTableData ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-muted/50">
                      <TableHead className="text-muted-foreground text-xs">Column</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Type</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Nullable</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columns.map((col) => (
                      <TableRow key={col.name} className="border-border">
                        <TableCell className="font-mono text-sm py-2">
                          {col.name}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className="font-mono text-xs font-normal">
                            {col.udt_type || col.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className={`text-xs ${col.nullable ? "text-muted-foreground" : "text-foreground"}`}>
                            {col.nullable ? "YES" : "NO"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          {col.is_primary_key && (
                            <div className="flex items-center gap-1 text-xs text-primary">
                              <Key className="w-3 h-3" />
                              PK
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Table2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Select a table to view its columns and structure</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
