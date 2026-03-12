"use client"

import { useState, type ReactNode } from "react"
import { type ColumnRow, type TableFilter } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const OPERATORS = [
  { value: "eq", label: "= equals" },
  { value: "neq", label: "!= not equals" },
  { value: "gt", label: "> greater than" },
  { value: "gte", label: ">= greater or equal" },
  { value: "lt", label: "< less than" },
  { value: "lte", label: "<= less or equal" },
  { value: "like", label: "LIKE" },
  { value: "ilike", label: "ILIKE (case insensitive)" },
  { value: "is_null", label: "IS NULL" },
  { value: "is_not_null", label: "IS NOT NULL" },
]

const NO_VALUE_OPS = new Set(["is_null", "is_not_null"])

interface TableFilterPopoverProps {
  columns: string[]
  columnMeta: ColumnRow[]
  onAddFilter: (filter: TableFilter) => void
  children: ReactNode
}

export function TableFilterPopover({
  columns,
  onAddFilter,
  children,
}: TableFilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [column, setColumn] = useState("")
  const [operator, setOperator] = useState("eq")
  const [value, setValue] = useState("")

  const handleAdd = () => {
    if (!column) return
    const filter: TableFilter = { column, operator }
    if (!NO_VALUE_OPS.has(operator)) {
      filter.value = value
    }
    onAddFilter(filter)
    setColumn("")
    setOperator("eq")
    setValue("")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Add Filter</div>
          <Select value={column} onValueChange={setColumn}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select column..." />
            </SelectTrigger>
            <SelectContent>
              {columns.map((col) => (
                <SelectItem key={col} value={col} className="text-xs font-mono">
                  {col}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={operator} onValueChange={setOperator}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value} className="text-xs">
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!NO_VALUE_OPS.has(operator) && (
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value..."
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          )}

          <Button
            size="sm"
            className="w-full h-8"
            onClick={handleAdd}
            disabled={!column}
          >
            Add Filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
