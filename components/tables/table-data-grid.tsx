"use client"

import { useState, useCallback, useRef, useEffect } from "react"
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

// ── Column resize hook ───────────────────────────────────────────────

function useColumnResize(columns: string[]) {
  const [widths, setWidths] = useState<Record<string, number>>({})
  const dragging = useRef<{
    col: string
    startX: number
    startWidth: number
  } | null>(null)

  const getWidth = useCallback(
    (col: string) => widths[col] || 150,
    [widths]
  )

  const onResizeStart = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startWidth = widths[col] || 150
      dragging.current = { col, startX: e.clientX, startWidth }

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return
        const diff = ev.clientX - dragging.current.startX
        const newW = Math.max(60, dragging.current.startWidth + diff)
        setWidths((prev) => ({ ...prev, [dragging.current!.col]: newW }))
      }

      const onMouseUp = () => {
        dragging.current = null
        document.removeEventListener("mousemove", onMouseMove)
        document.removeEventListener("mouseup", onMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.addEventListener("mousemove", onMouseMove)
      document.addEventListener("mouseup", onMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [widths]
  )

  // Reset widths when columns change
  useEffect(() => {
    setWidths({})
  }, [columns.join(",")])

  return { getWidth, onResizeStart }
}

// ── Grid component ───────────────────────────────────────────────────

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

  // Column resizing
  const { getWidth, onResizeStart } = useColumnResize(visibleColumns)

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    rowKey: string
    column: string
  } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)
  // Track the anchor <td> element for the floating editor
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const handleCellClick = useCallback(
    (
      rowKey: string,
      col: string,
      row: Record<string, unknown>,
      tdElement: HTMLElement
    ) => {
      if (!hasPrimaryKey || !onUpdateCell) return
      const meta = columnMeta.find((c) => c.name === col)
      if (!meta || meta.is_primary_key) return

      // If already editing this cell, do nothing
      if (editingCell?.rowKey === rowKey && editingCell?.column === col) return

      // Open editor for this cell
      setEditingCell({ rowKey, column: col })
      setEditValue(valueToString(row[col]))
      setAnchorEl(tdElement)
    },
    [hasPrimaryKey, onUpdateCell, columnMeta, editingCell]
  )

  const handleCancel = useCallback(() => {
    setEditingCell(null)
    setEditValue("")
    setAnchorEl(null)
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
      setAnchorEl(null)
    } catch {
      // Keep editor open on error — user can retry or cancel
    } finally {
      setSaving(false)
    }
  }, [
    editingCell,
    onUpdateCell,
    rows,
    getRowKey,
    columnMeta,
    primaryKeys,
    editValue,
    handleCancel,
  ])

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
      setAnchorEl(null)
    } catch {
      // Keep editor open on error
    } finally {
      setSaving(false)
    }
  }, [editingCell, onUpdateCell, rows, getRowKey, primaryKeys])

  // Close editor on outside click
  useEffect(() => {
    if (!editingCell) return
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking inside a floating portal
      const target = e.target as HTMLElement
      if (target.closest("[data-floating-ui-portal]")) return
      handleCancel()
    }
    // Use a slight delay so the cell click handler fires first
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [editingCell, handleCancel])

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
        <Table style={{ tableLayout: "fixed" }}>
          <TableHeader>
            <TableRow className="border-border bg-muted/50">
              {hasPrimaryKey && (
                <TableHead
                  className="px-3 border-r border-border"
                  style={{ width: 40 }}
                >
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAllOnPage}
                    aria-label="Select all rows on page"
                  />
                </TableHead>
              )}
              {visibleColumns.map((col) => {
                const isSorted = sort === col
                const w = getWidth(col)
                return (
                  <TableHead
                    key={col}
                    className="text-muted-foreground text-xs select-none whitespace-nowrap border-r border-border relative group"
                    style={{ width: w, minWidth: w, maxWidth: w }}
                  >
                    <div
                      className="flex items-center gap-1 cursor-pointer hover:text-foreground pr-2"
                      onClick={() => toggleSort(col)}
                    >
                      <span className="font-mono truncate">{col}</span>
                      {isSorted &&
                        (sortDir === "asc" ? (
                          <ArrowUp className="w-3 h-3 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3 h-3 shrink-0" />
                        ))}
                      {!isSorted && (
                        <span className="w-3 h-3 shrink-0 inline-block" />
                      )}
                      <span className="text-muted-foreground/50 font-normal truncate">
                        {columnMeta.find((c) => c.name === col)?.udt_type || ""}
                      </span>
                    </div>
                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover:opacity-100 hover:!opacity-100 z-10"
                      onMouseDown={(e) => onResizeStart(col, e)}
                    >
                      <div className="absolute right-0 top-1 bottom-1 w-0.5 bg-primary/40 rounded-full" />
                    </div>
                  </TableHead>
                )
              })}
              {hasPrimaryKey && (
                <TableHead
                  className="text-muted-foreground text-xs"
                  style={{ width: 40 }}
                />
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
                    <TableCell
                      className="px-3 py-1.5 border-r border-border"
                      style={{ width: 40 }}
                    >
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
                    const w = getWidth(col)

                    return (
                      <TableCell
                        key={col}
                        className={`py-1.5 font-mono text-sm border-r border-border truncate ${
                          isEditing
                            ? "ring-2 ring-primary ring-inset bg-primary/5"
                            : ""
                        } ${
                          canEdit && !isEditing
                            ? "cursor-pointer hover:bg-muted/30"
                            : ""
                        }`}
                        style={{ width: w, minWidth: w, maxWidth: w }}
                        onClick={(e) => {
                          if (!isEditing && canEdit) {
                            handleCellClick(
                              rowKey,
                              col,
                              row,
                              e.currentTarget as HTMLElement
                            )
                          }
                        }}
                      >
                        {isNull ? (
                          <span className="text-muted-foreground/40 text-xs italic">
                            NULL
                          </span>
                        ) : (
                          <span className="truncate block" title={display}>
                            {display}
                          </span>
                        )}
                        {/* Popout editor is rendered via FloatingPortal from CellEditor */}
                        {isEditing && meta && (
                          <CellEditor
                            value={editValue}
                            column={meta}
                            onChange={setEditValue}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            onSetNull={handleSetNull}
                            saving={saving}
                            anchorEl={anchorEl}
                          />
                        )}
                      </TableCell>
                    )
                  })}
                  {hasPrimaryKey && (
                    <TableCell
                      className="py-1.5 px-2"
                      style={{ width: 40 }}
                    >
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
