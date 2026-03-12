"use client"

import { useRef, useEffect } from "react"
import { type ColumnRow } from "@/lib/api-client"
import { getInputType } from "@/lib/table-utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

export interface CellEditorProps {
  value: string
  column: ColumnRow
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  onSetNull: () => void
  saving: boolean
}

// ── Action bar shown below the editor ────────────────────────────────

function EditorActionBar({
  column,
  onSave,
  onCancel,
  onSetNull,
  saving,
}: Pick<CellEditorProps, "column" | "onSave" | "onCancel" | "onSetNull" | "saving">) {
  return (
    <div className="absolute left-0 top-full mt-1 z-30 flex items-center gap-1.5 bg-popover border border-border rounded-md shadow-md px-2 py-1.5 whitespace-nowrap">
      {column.nullable && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={(e) => {
            e.stopPropagation()
            onSetNull()
          }}
          disabled={saving}
        >
          Set NULL
        </Button>
      )}
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs px-2 gap-1"
        onClick={(e) => {
          e.stopPropagation()
          onCancel()
        }}
        disabled={saving}
      >
        Cancel
        <kbd className="ml-0.5 text-[10px] text-muted-foreground bg-muted rounded px-1 py-0.5 font-sans">
          Esc
        </kbd>
      </Button>
      <Button
        size="sm"
        className="h-6 text-xs px-2 gap-1"
        onClick={(e) => {
          e.stopPropagation()
          onSave()
        }}
        disabled={saving}
      >
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            Save
            <kbd className="ml-0.5 text-[10px] text-muted-foreground/70 bg-primary-foreground/20 rounded px-1 py-0.5 font-sans">
              ⌘↵
            </kbd>
          </>
        )}
      </Button>
    </div>
  )
}

// ── Text / Number / Date editor ──────────────────────────────────────

function InputCellEditor({
  value,
  column,
  onChange,
  onSave,
  onCancel,
  onSetNull,
  saving,
  inputType,
}: CellEditorProps & { inputType: string }) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus and select on mount
    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      e.stopPropagation()
      onSave()
    } else if (e.key === "Enter" && inputType !== "textarea") {
      e.preventDefault()
      e.stopPropagation()
      onSave()
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type={inputType === "text" ? "text" : inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="h-7 text-xs font-mono bg-background border-0 ring-0 shadow-none focus-visible:ring-0 p-0 rounded-none"
        onClick={(e) => e.stopPropagation()}
      />
      <EditorActionBar
        column={column}
        onSave={onSave}
        onCancel={onCancel}
        onSetNull={onSetNull}
        saving={saving}
      />
    </div>
  )
}

// ── Textarea editor (JSON/JSONB) ─────────────────────────────────────

function TextareaCellEditor({
  value,
  column,
  onChange,
  onSave,
  onCancel,
  onSetNull,
  saving,
}: CellEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      e.stopPropagation()
      onSave()
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        rows={3}
        className="w-full text-xs font-mono bg-background border-0 ring-0 shadow-none focus:outline-none resize-y min-h-[28px] p-0 rounded-none"
        onClick={(e) => e.stopPropagation()}
      />
      <EditorActionBar
        column={column}
        onSave={onSave}
        onCancel={onCancel}
        onSetNull={onSetNull}
        saving={saving}
      />
    </div>
  )
}

// ── Boolean editor (dropdown) ────────────────────────────────────────

function BooleanCellEditor({
  value,
  column,
  onChange,
  onSave,
  onCancel,
  saving,
}: CellEditorProps) {
  const handleSelect = (newValue: string) => {
    onChange(newValue)
    // Boolean saves immediately on selection
    // We need a small delay so onChange is processed first
    setTimeout(() => {
      onSave()
    }, 0)
  }

  // Map current value to select value
  const selectValue =
    value === "true" ? "true" : value === "false" ? "false" : "null"

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Select
        value={selectValue}
        onValueChange={handleSelect}
        disabled={saving}
        open
        onOpenChange={(open) => {
          if (!open) onCancel()
        }}
      >
        <SelectTrigger className="h-7 text-xs font-mono border-0 ring-0 shadow-none p-0 rounded-none bg-transparent focus:ring-0 [&>svg]:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">TRUE</SelectItem>
          <SelectItem value="false">FALSE</SelectItem>
          {column.nullable && <SelectItem value="null">NULL</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  )
}

// ── Main dispatcher ──────────────────────────────────────────────────

export function CellEditor(props: CellEditorProps) {
  const inputType = getInputType(props.column)

  switch (inputType) {
    case "boolean":
      return <BooleanCellEditor {...props} />
    case "textarea":
      return <TextareaCellEditor {...props} />
    case "number":
    case "date":
    case "time":
    case "datetime-local":
      return <InputCellEditor {...props} inputType={inputType} />
    default:
      return <InputCellEditor {...props} inputType="text" />
  }
}
