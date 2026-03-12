"use client"

import { useState, useEffect } from "react"
import { type ColumnRow } from "@/lib/api-client"
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
import { Pencil, Loader2 } from "lucide-react"

interface EditRecordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columnMeta: ColumnRow[]
  row: Record<string, unknown> | null
  primaryKeys: string[]
  onSubmit: (
    pkValues: Record<string, unknown>,
    data: Record<string, unknown>
  ) => Promise<void>
}

function getInputType(col: ColumnRow): string {
  const t = col.udt_type || col.type
  if (["int2", "int4", "int8", "float4", "float8", "numeric", "decimal", "integer", "bigint", "smallint", "real", "double precision"].includes(t)) return "number"
  if (["bool", "boolean"].includes(t)) return "boolean"
  if (["timestamp", "timestamptz"].includes(t)) return "datetime-local"
  if (["date"].includes(t)) return "date"
  if (["time", "timetz"].includes(t)) return "time"
  if (["json", "jsonb"].includes(t)) return "textarea"
  return "text"
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}

export function EditRecordDialog({
  open,
  onOpenChange,
  columnMeta,
  row,
  primaryKeys,
  onSubmit,
}: EditRecordDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [nullFlags, setNullFlags] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && row) {
      const initVals: Record<string, string> = {}
      const initNulls: Record<string, boolean> = {}
      for (const col of columnMeta) {
        const val = row[col.name]
        initVals[col.name] = valueToString(val)
        initNulls[col.name] = val === null || val === undefined
      }
      setValues(initVals)
      setNullFlags(initNulls)
      setError(null)
    }
  }, [open, row, columnMeta])

  const handleSubmit = async () => {
    if (!row) return
    setSaving(true)
    setError(null)
    try {
      // Build PK values
      const pkValues: Record<string, unknown> = {}
      for (const pk of primaryKeys) {
        pkValues[pk] = row[pk]
      }

      // Build changed data
      const data: Record<string, unknown> = {}
      for (const col of columnMeta) {
        if (primaryKeys.includes(col.name)) continue // don't update PKs
        const originalNull = row[col.name] === null || row[col.name] === undefined
        const nowNull = nullFlags[col.name]
        const originalStr = valueToString(row[col.name])
        const currentStr = values[col.name]

        if (nowNull && !originalNull) {
          data[col.name] = null
        } else if (!nowNull && originalNull) {
          const inputType = getInputType(col)
          if (inputType === "number") {
            data[col.name] = currentStr === "" ? null : Number(currentStr)
          } else if (inputType === "boolean") {
            data[col.name] = currentStr === "true"
          } else if (inputType === "textarea") {
            try { data[col.name] = JSON.parse(currentStr) } catch { data[col.name] = currentStr }
          } else {
            data[col.name] = currentStr
          }
        } else if (!nowNull && currentStr !== originalStr) {
          const inputType = getInputType(col)
          if (inputType === "number") {
            data[col.name] = currentStr === "" ? null : Number(currentStr)
          } else if (inputType === "boolean") {
            data[col.name] = currentStr === "true"
          } else if (inputType === "textarea") {
            try { data[col.name] = JSON.parse(currentStr) } catch { data[col.name] = currentStr }
          } else {
            data[col.name] = currentStr
          }
        }
      }

      if (Object.keys(data).length === 0) {
        onOpenChange(false)
        return
      }

      await onSubmit(pkValues, data)
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!row) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Edit Record
          </DialogTitle>
          <DialogDescription>Modify values and save changes.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-3 py-1">
            {columnMeta.map((col) => {
              const isPk = primaryKeys.includes(col.name)
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
                      {isPk && (
                        <Badge variant="secondary" className="text-[10px]">PK</Badge>
                      )}
                    </label>
                    {col.nullable && !isPk && (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <Switch
                          checked={isNull}
                          onCheckedChange={(checked) =>
                            setNullFlags((p) => ({ ...p, [col.name]: checked }))
                          }
                          className="scale-75"
                        />
                        NULL
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
                        disabled={isPk || isNull}
                      />
                      <span className="text-sm text-muted-foreground">
                        {isNull ? "null" : values[col.name] === "true" ? "true" : "false"}
                      </span>
                    </div>
                  ) : inputType === "textarea" ? (
                    <textarea
                      value={isNull ? "" : values[col.name] || ""}
                      onChange={(e) =>
                        setValues((p) => ({ ...p, [col.name]: e.target.value }))
                      }
                      disabled={isPk || isNull}
                      className="flex w-full rounded-md border border-input bg-input px-3 py-2 text-sm font-mono min-h-[60px] disabled:opacity-50"
                    />
                  ) : (
                    <Input
                      type={inputType}
                      value={isNull ? "" : values[col.name] || ""}
                      onChange={(e) =>
                        setValues((p) => ({ ...p, [col.name]: e.target.value }))
                      }
                      disabled={isPk || isNull}
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
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
