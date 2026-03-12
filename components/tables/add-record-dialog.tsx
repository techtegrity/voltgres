"use client"

import { useState, useEffect } from "react"
import { type ColumnRow } from "@/lib/api-client"
import { getInputType, isAutoColumn } from "@/lib/table-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Loader2 } from "lucide-react"

interface AddRecordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columnMeta: ColumnRow[]
  onSubmit: (data: Record<string, unknown>) => Promise<void>
}

export function AddRecordDialog({
  open,
  onOpenChange,
  columnMeta,
  onSubmit,
}: AddRecordDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [nullFlags, setNullFlags] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      // Initialize: auto columns and nullable columns start as null
      const initVals: Record<string, string> = {}
      const initNulls: Record<string, boolean> = {}
      for (const col of columnMeta) {
        initVals[col.name] = ""
        initNulls[col.name] = isAutoColumn(col) || col.nullable
      }
      setValues(initVals)
      setNullFlags(initNulls)
      setError(null)
    }
  }, [open, columnMeta])

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const data: Record<string, unknown> = {}
      for (const col of columnMeta) {
        if (isAutoColumn(col) && nullFlags[col.name]) continue // skip auto columns left as default
        if (nullFlags[col.name]) {
          data[col.name] = null
          continue
        }
        const inputType = getInputType(col)
        const raw = values[col.name] ?? ""
        if (inputType === "number") {
          data[col.name] = raw === "" ? null : Number(raw)
        } else if (inputType === "boolean") {
          data[col.name] = raw === "true"
        } else if (inputType === "textarea") {
          try {
            data[col.name] = raw ? JSON.parse(raw) : null
          } catch {
            data[col.name] = raw || null
          }
        } else {
          data[col.name] = raw || null
        }
      }
      await onSubmit(data)
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Record
          </DialogTitle>
          <DialogDescription>Insert a new row into the table.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-3 py-1">
            {columnMeta.map((col) => {
              const auto = isAutoColumn(col)
              const inputType = getInputType(col)
              const isNull = nullFlags[col.name]

              return (
                <div key={col.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-mono font-medium flex items-center gap-2">
                      {col.name}
                      <Badge variant="outline" className="font-mono text-[10px] font-normal">
                        {col.udt_type || col.type}
                      </Badge>
                      {col.is_primary_key && (
                        <Badge variant="secondary" className="text-[10px]">PK</Badge>
                      )}
                    </label>
                    {(col.nullable || auto) && (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <Switch
                          checked={isNull}
                          onCheckedChange={(checked) =>
                            setNullFlags((p) => ({ ...p, [col.name]: checked }))
                          }
                          className="scale-75"
                        />
                        {auto ? "Default" : "NULL"}
                      </label>
                    )}
                  </div>

                  {inputType === "boolean" ? (
                    <div className="flex items-center gap-2 h-9">
                      <Checkbox
                        checked={values[col.name] === "true"}
                        onCheckedChange={(c) =>
                          setValues((p) => ({ ...p, [col.name]: c ? "true" : "false" }))
                        }
                        disabled={isNull}
                      />
                      <span className="text-sm text-muted-foreground">
                        {isNull ? (auto ? "default" : "null") : values[col.name] === "true" ? "true" : "false"}
                      </span>
                    </div>
                  ) : inputType === "textarea" ? (
                    <textarea
                      value={isNull ? "" : values[col.name] || ""}
                      onChange={(e) =>
                        setValues((p) => ({ ...p, [col.name]: e.target.value }))
                      }
                      disabled={isNull}
                      placeholder={auto ? "auto" : col.nullable ? "null" : ""}
                      className="flex w-full rounded-md border border-input bg-input px-3 py-2 text-sm font-mono min-h-[60px] disabled:opacity-50"
                    />
                  ) : (
                    <Input
                      type={inputType}
                      value={isNull ? "" : values[col.name] || ""}
                      onChange={(e) =>
                        setValues((p) => ({ ...p, [col.name]: e.target.value }))
                      }
                      disabled={isNull}
                      placeholder={auto ? "auto" : col.nullable ? "null" : ""}
                      className="h-9 text-sm font-mono bg-input"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Insert Row
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
