"use client"

import { type ColumnRow } from "@/lib/api-client"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown, MoreVertical, Pencil, Trash2, Copy } from "lucide-react"

interface TableDataGridProps {
  rows: Record<string, unknown>[]
  visibleColumns: string[]
  columnMeta: ColumnRow[]
  sort: string | undefined
  sortDir: "asc" | "desc"
  toggleSort: (column: string) => void
  selectedRows: Set<string>
  toggleRowSelection: (rowKey: string) => void
  toggleAllOnPage: () => void
  getRowKey: (row: Record<string, unknown>) => string
  hasPrimaryKey: boolean
  onEditRow: (row: Record<string, unknown>) => void
  onDeleteRow: (row: Record<string, unknown>) => void
  loading: boolean
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function TableDataGrid({
  rows,
  visibleColumns,
  columnMeta,
  sort,
  sortDir,
  toggleSort,
  selectedRows,
  toggleRowSelection,
  toggleAllOnPage,
  getRowKey,
  hasPrimaryKey,
  onEditRow,
  onDeleteRow,
  loading,
}: TableDataGridProps) {
  const allSelected =
    rows.length > 0 && rows.every((r) => selectedRows.has(getRowKey(r)))

  if (loading && rows.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">
        Loading data...
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">
        No rows found
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/50">
              {hasPrimaryKey && (
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAllOnPage}
                    aria-label="Select all rows on page"
                  />
                </TableHead>
              )}
              {visibleColumns.map((col) => {
                const isSorted = sort === col
                return (
                  <TableHead
                    key={col}
                    className="text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                    onClick={() => toggleSort(col)}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-mono">{col}</span>
                      {isSorted &&
                        (sortDir === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                      {!isSorted && (
                        <span className="w-3 h-3 inline-block" />
                      )}
                      <span className="text-muted-foreground/50 font-normal">
                        {columnMeta.find((c) => c.name === col)?.udt_type || ""}
                      </span>
                    </div>
                  </TableHead>
                )
              })}
              {hasPrimaryKey && (
                <TableHead className="w-10 text-muted-foreground text-xs" />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const rowKey = getRowKey(row)
              const isSelected = selectedRows.has(rowKey)
              return (
                <TableRow
                  key={rowKey}
                  className={`border-border ${isSelected ? "bg-primary/5" : ""}`}
                >
                  {hasPrimaryKey && (
                    <TableCell className="w-10 px-3 py-1.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRowSelection(rowKey)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((col) => {
                    const value = row[col]
                    const isNull = value === null || value === undefined
                    const display = formatCellValue(value)
                    return (
                      <TableCell
                        key={col}
                        className="py-1.5 font-mono text-sm max-w-[300px] truncate"
                      >
                        {isNull ? (
                          <span className="text-muted-foreground/40 text-xs italic">
                            NULL
                          </span>
                        ) : (
                          <span title={display}>{display}</span>
                        )}
                      </TableCell>
                    )
                  })}
                  {hasPrimaryKey && (
                    <TableCell className="w-10 py-1.5 px-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditRow(row)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Row
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDeleteRow(row)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Row
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              navigator.clipboard.writeText(
                                JSON.stringify(row, null, 2)
                              )
                            }
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy as JSON
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
