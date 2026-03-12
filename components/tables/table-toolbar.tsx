"use client"

import { type ColumnRow, type TableFilter } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Filter, Columns3, X } from "lucide-react"
import { TableFilterPopover } from "./table-filter-popover"
import { TableColumnVisibility } from "./table-column-visibility"

const OPERATOR_LABELS: Record<string, string> = {
  eq: "=",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
  ilike: "ILIKE",
  is_null: "IS NULL",
  is_not_null: "IS NOT NULL",
}

interface TableToolbarProps {
  columns: string[]
  columnMeta: ColumnRow[]
  visibleColumns: string[]
  setVisibleColumns: (columns: string[]) => void
  toggleColumn: (column: string) => void
  filters: TableFilter[]
  addFilter: (filter: TableFilter) => void
  removeFilter: (index: number) => void
  clearFilters: () => void
  pageSize: number
  setPageSize: (size: number) => void
  totalCount: number
  executionTime: number
}

export function TableToolbar({
  columns,
  columnMeta,
  visibleColumns,
  setVisibleColumns,
  toggleColumn,
  filters,
  addFilter,
  removeFilter,
  clearFilters,
  pageSize,
  setPageSize,
  totalCount,
  executionTime,
}: TableToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TableFilterPopover
            columns={columns}
            columnMeta={columnMeta}
            onAddFilter={addFilter}
          >
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Filters
              {filters.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {filters.length}
                </Badge>
              )}
            </Button>
          </TableFilterPopover>

          <TableColumnVisibility
            columns={columns}
            visibleColumns={visibleColumns}
            setVisibleColumns={setVisibleColumns}
            toggleColumn={toggleColumn}
          >
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Columns3 className="w-3.5 h-3.5" />
              Columns
            </Button>
          </TableColumnVisibility>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {totalCount.toLocaleString()} rows
            {executionTime > 0 && <> &middot; {executionTime}ms</>}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(parseInt(v, 10))}
          >
            <SelectTrigger className="h-8 w-[80px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="250">250</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filter badges */}
      {filters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((f, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="gap-1 pr-1 font-mono text-xs"
            >
              {f.column} {OPERATOR_LABELS[f.operator] || f.operator}{" "}
              {f.value !== undefined ? `'${f.value}'` : ""}
              <button
                onClick={() => removeFilter(i)}
                className="ml-0.5 hover:text-foreground rounded-sm"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
