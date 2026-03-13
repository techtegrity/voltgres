"use client"

import { type ColumnRow } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Key, User } from "lucide-react"

interface TableStructureViewProps {
  columns: ColumnRow[]
  owner?: string
}

export function TableStructureView({ columns, owner }: TableStructureViewProps) {
  if (columns.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No columns found
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {owner && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="w-3.5 h-3.5" />
          Owner: <span className="font-mono text-foreground">{owner}</span>
        </div>
      )}
      <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border bg-muted/50">
            <TableHead className="text-muted-foreground text-xs">Column</TableHead>
            <TableHead className="text-muted-foreground text-xs">Type</TableHead>
            <TableHead className="text-muted-foreground text-xs">Nullable</TableHead>
            <TableHead className="text-muted-foreground text-xs">Default</TableHead>
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
                <span
                  className={`text-xs ${col.nullable ? "text-muted-foreground" : "text-foreground"}`}
                >
                  {col.nullable ? "YES" : "NO"}
                </span>
              </TableCell>
              <TableCell className="py-2">
                {col.default_value ? (
                  <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px] block">
                    {col.default_value}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">-</span>
                )}
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
    </div>
  )
}
