"use client"

import { type ReactNode } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TableColumnVisibilityProps {
  columns: string[]
  visibleColumns: string[]
  setVisibleColumns: (columns: string[]) => void
  toggleColumn: (column: string) => void
  children: ReactNode
}

export function TableColumnVisibility({
  columns,
  visibleColumns,
  setVisibleColumns,
  toggleColumn,
  children,
}: TableColumnVisibilityProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">
              Toggle columns
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setVisibleColumns(columns)}
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setVisibleColumns([])}
              >
                None
              </Button>
            </div>
          </div>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-0.5">
              {columns.map((col) => (
                <label
                  key={col}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={visibleColumns.includes(col)}
                    onCheckedChange={() => toggleColumn(col)}
                  />
                  <span className="text-xs font-mono truncate">{col}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  )
}
