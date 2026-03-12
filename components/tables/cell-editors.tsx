"use client"

import { useRef, useEffect, useCallback } from "react"
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
  FloatingFocusManager,
} from "@floating-ui/react"
import { type ColumnRow } from "@/lib/api-client"
import { getInputType } from "@/lib/table-utils"
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
  /** The <td> element (or wrapper) that anchors this editor */
  anchorEl: HTMLElement | null
}

// ── Action bar at the bottom of every popout editor ──────────────────

function EditorActionBar({
  column,
  onSave,
  onCancel,
  onSetNull,
  saving,
}: Pick<CellEditorProps, "column" | "onSave" | "onCancel" | "onSetNull" | "saving">) {
  return (
    <div className="flex items-center gap-1.5 border-t border-border px-2 py-1.5 bg-muted/30">
      {column.nullable && (
        <Button
          variant="outline"
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
        variant="outline"
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

// ── Text / Number / Date popout ──────────────────────────────────────

function InputPopout({
  value,
  column,
  onChange,
  onSave,
  onCancel,
  onSetNull,
  saving,
  anchorEl,
  inputType,
}: CellEditorProps & { inputType: string }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const { refs, floatingStyles, context } = useFloating({
    open: true,
    placement: "bottom-start",
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchorEl },
  })

  useEffect(() => {
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
    } else if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()
      onSave()
    }
  }

  // Match anchor width, minimum 240px
  const minWidth = anchorEl ? Math.max(anchorEl.offsetWidth, 240) : 240

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false}>
        <div
          ref={refs.setFloating}
          style={{ ...floatingStyles, minWidth }}
          className="z-50 rounded-md border border-border bg-popover shadow-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2">
            <input
              ref={inputRef}
              type={inputType === "text" ? "text" : inputType}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={saving}
              className="w-full h-8 text-sm font-mono bg-background border border-border rounded px-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <EditorActionBar
            column={column}
            onSave={onSave}
            onCancel={onCancel}
            onSetNull={onSetNull}
            saving={saving}
          />
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

// ── Textarea popout (JSON / text / long content) ─────────────────────

function TextareaPopout({
  value,
  column,
  onChange,
  onSave,
  onCancel,
  onSetNull,
  saving,
  anchorEl,
}: CellEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { refs, floatingStyles, context } = useFloating({
    open: true,
    placement: "bottom-start",
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchorEl },
  })

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.focus()
      el.setSelectionRange(0, el.value.length)
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

  const minWidth = anchorEl ? Math.max(anchorEl.offsetWidth, 320) : 320

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false}>
        <div
          ref={refs.setFloating}
          style={{ ...floatingStyles, minWidth }}
          className="z-50 rounded-md border border-border bg-popover shadow-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={saving}
              rows={6}
              className="w-full text-sm font-mono bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary resize-y min-h-[80px]"
            />
          </div>
          <EditorActionBar
            column={column}
            onSave={onSave}
            onCancel={onCancel}
            onSetNull={onSetNull}
            saving={saving}
          />
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

// ── Boolean popout (dropdown) ────────────────────────────────────────

function BooleanPopout({
  value,
  column,
  onChange,
  onSave,
  onCancel,
  onSetNull,
  saving,
  anchorEl,
}: CellEditorProps) {
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    placement: "bottom-start",
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchorEl },
  })

  const selectValue =
    value === "true" ? "true" : value === "false" ? "false" : "null"

  const handleSelect = useCallback(
    (newValue: string) => {
      if (newValue === "null") {
        onSetNull()
      } else {
        onChange(newValue)
        // Save immediately on boolean selection
        setTimeout(() => onSave(), 0)
      }
    },
    [onChange, onSave, onSetNull]
  )

  const minWidth = anchorEl ? Math.max(anchorEl.offsetWidth, 140) : 140

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false}>
        <div
          ref={refs.setFloating}
          style={{ ...floatingStyles, minWidth }}
          className="z-50 rounded-md border border-border bg-popover shadow-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            {[
              { value: "true", label: "TRUE" },
              { value: "false", label: "FALSE" },
              ...(column.nullable
                ? [{ value: "null", label: "NULL" }]
                : []),
            ].map((opt) => (
              <button
                key={opt.value}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/80 flex items-center justify-between ${
                  selectValue === opt.value ? "bg-muted/50 font-medium" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelect(opt.value)
                }}
                disabled={saving}
              >
                {opt.label}
                {selectValue === opt.value && (
                  <span className="text-muted-foreground">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

// ── Main dispatcher ──────────────────────────────────────────────────

export function CellEditor(props: CellEditorProps) {
  const inputType = getInputType(props.column)

  switch (inputType) {
    case "boolean":
      return <BooleanPopout {...props} />
    case "textarea":
      return <TextareaPopout {...props} />
    case "number":
    case "date":
    case "time":
    case "datetime-local":
      return <InputPopout {...props} inputType={inputType} />
    default:
      // Use textarea popout for long text content, input for short values
      if (props.value.length > 80 || props.value.includes("\n")) {
        return <TextareaPopout {...props} />
      }
      return <InputPopout {...props} inputType="text" />
  }
}
