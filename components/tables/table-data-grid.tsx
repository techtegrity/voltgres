"use client"

import { useState, useCallback } from "react"
import { type ColumnRow } from "@/lib/api-client"
import { convertValue, valueToString } from "@/lib/table-utils"
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
import { CellEditor } from "./cell-editors"

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
  primaryKeys: string[]
  onEditRow: (row: Record<string, unknown>) => void
  onDeleteRow: (row: Record<string, unknown>) => void
  onUpdateCell?: (
    pkValues: Record<string, unknown>,
    column: string,
    value: unknown
  ) => Promise<void>
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
  primaryKeys,
  onEditRow,
  onDeleteRow,
  onUpdateCell,
  loading,
}: TableDataGridProps) {
  const allSelected =
    rows.length > 0 && rows.every((r) => selectedRows.has(getRowKey(r)))

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    rowKey: string
    column: string
  } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)

  const handleCellClick = useCallback(
    (rowKey: string, col: string, row: Record<string, unknown>) => {
      if (!hasPrimaryKey || !onUpdateCell) return
      const meta = columnMeta.find((c) => c.name === col)
      if (!meta || meta.is_primary_key) return

      // If already editing this cell, do nothing
      if (editingCell?.rowKey === rowKey && editingCell?.column === col) return

      // Open editor for this cell
      setEditingCell({ rowKey, column: col })
      setEditValue(valueToString(row[col]))
    },
    [hasPrimaryKey, onUpdateCell, columnMeta, editingCell]
  )

  const handleCancel = useCallback(() => {
    setEditingCell(null)
    setEditValue("")
  }, [])

  const handleSave = useCallback(async () => {
    if (!editingCell || !onUpdateCell) return
    const row = rows.find((r) => getRowKey(r) === editingCell.rowKey)
    if (!row) return

    const meta = columnMeta.find((c) => c.name === editingCell.column)
    if (!meta) return

    // Check if value actually changed
    const originalStr = valueToString(row[editingCell.column])
    if (editValue === originalStr) {
      handleCancel()
      return
    }

    const pkValues: Record<string, unknown> = {}
    for (const pk of primaryKeys) {
      pkValues[pk] = row[pk]
    }

    const typedValue = convertValue(editValue, meta, false)

    setSaving(true)
    try {
      await onUpdateCell(pkValues, editingCell.column, typedValue)
      setEditingCell(null)
      setEditValue("")
    } catch {
      // Keep editor open on error — user can retry or cancel
    } finally {
      setSaving(false)
    }
  }, [editingCell, onUpdateCell, rows, getRowKey, columnMeta, primaryKeys, editValue, handleCancel])

  const handleSetNull = useCallback(async () => {
    if (!editingCell || !onUpdateCell) return
    const row = rows.find((r) => getRowKey(r) === editingCell.rowKey)
    if (!row) return

    const pkValues: Record<string, unknown> = {}
    for (const pk of primaryKeys) {
      pkValues[pk] = row[pk]
    }

    setSaving(true)
    try {
      await onUpdateCell(pkValues, editingCell.column, null)
      setEditingCell(null)
      setEditValue("")
    } catch {
      // Keep editor open on error
    } finally {
      setSaving(false)
    }
  }, [editingCell, onUpdateCell, rows, getRowKey, primaryKeys])

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
                <TableHead className="w-10 px-3 border-r border-border">
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
                    className="text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none whitespace-nowrap border-r border-border"
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
              const isEditingRow = editingCell?.rowKey === rowKey
              return (
                <TableRow
                  key={rowKey}
                  className={`border-border ${isSelected ? "bg-primary/5" : ""} ${
                    isEditingRow ? "z-10 relative" : ""
                  }`}
                >
                  {hasPrimaryKey && (
                    <TableCell className="w-10 px-3 py-1.5 border-r border-border">
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
                    const isEditing =
                      editingCell?.rowKey === rowKey &&
                      editingCell?.column === col
                    const meta = columnMeta.find((c) => c.name === col)
                    const isPk = meta?.is_primary_key
                    const canEdit =
                      hasPrimaryKey && onUpdateCell && !isPk

                    return (
                      <TableCell
                        key={col}
                        className={`py-1.5 font-mono text-sm border-r border-border ${
                          isEditing
                            ? "ring-2 ring-primary ring-inset relative overflow-visible p-1.5 bg-background"
                            : "max-w-[300px] truncate"
                        } ${
                          canEdit && !isEditing
                            ? "cursor-pointer hover:bg-muted/30"
                            : ""
                        }`}
                        onClick={() => {
                          if (!isEditing && canEdit) {
                            handleCellClick(rowKey, col, row)
                          }
                        }}
                      >
                        {isEditing && meta ? (
                          <CellEditor
                            value={editValue}
                            column={meta}
                            onChange={setEditValue}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            onSetNull={handleSetNull}
                            saving={saving}
                          />
                        ) : isNull ? (
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
