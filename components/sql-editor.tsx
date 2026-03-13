"use client"

import { useRef, useEffect, useCallback } from "react"
import { EditorView, keymap, placeholder as phExtension } from "@codemirror/view"
import { EditorState, Compartment } from "@codemirror/state"
import { basicSetup } from "codemirror"
import { sql, PostgreSQL } from "@codemirror/lang-sql"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"

const themeCompartment = new Compartment()

function createTheme(isDark: boolean) {
  const editorTheme = EditorView.theme(
    {
      "&": {
        backgroundColor: "var(--muted)",
        color: "var(--foreground)",
        fontSize: "14px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
      },
      "&.cm-focused": {
        outline: "2px solid var(--ring)",
        outlineOffset: "-1px",
      },
      ".cm-content": {
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        padding: "12px 0",
        caretColor: "var(--foreground)",
        minHeight: "4lh",
      },
      ".cm-scroller": {
        minHeight: "4lh",
      },
      ".cm-cursor": {
        borderLeftColor: "var(--foreground)",
      },
      ".cm-activeLine": {
        backgroundColor: isDark
          ? "oklch(0.28 0 0 / 0.5)"
          : "oklch(0.90 0 0 / 0.5)",
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: isDark
          ? "oklch(0.72 0.19 155 / 0.2)"
          : "oklch(0.55 0.18 155 / 0.15)",
      },
      ".cm-gutters": {
        backgroundColor: "transparent",
        color: "var(--muted-foreground)",
        border: "none",
        paddingLeft: "4px",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "var(--foreground)",
      },
      ".cm-placeholder": {
        color: "var(--muted-foreground)",
      },
    },
    { dark: isDark }
  )

  const highlightStyle = HighlightStyle.define([
    // Keywords: SELECT, FROM, WHERE, etc.
    {
      tag: tags.keyword,
      color: isDark ? "oklch(0.72 0.19 155)" : "oklch(0.45 0.18 155)",
      fontWeight: "600",
    },
    // Strings
    {
      tag: tags.string,
      color: isDark ? "oklch(0.78 0.15 80)" : "oklch(0.55 0.15 80)",
    },
    // Numbers
    {
      tag: tags.number,
      color: isDark ? "oklch(0.78 0.15 250)" : "oklch(0.50 0.15 250)",
    },
    // Comments
    {
      tag: tags.comment,
      color: "var(--muted-foreground)",
      fontStyle: "italic",
    },
    // Operators: =, >, <, etc.
    {
      tag: tags.operator,
      color: isDark ? "oklch(0.75 0.12 30)" : "oklch(0.50 0.12 30)",
    },
    // Types: INT, VARCHAR, etc.
    {
      tag: tags.typeName,
      color: isDark ? "oklch(0.75 0.15 300)" : "oklch(0.50 0.15 300)",
    },
    // Punctuation: parentheses, commas, semicolons
    { tag: tags.punctuation, color: "var(--muted-foreground)" },
    // Built-in functions: COUNT, SUM, etc.
    {
      tag: tags.standard(tags.name),
      color: isDark ? "oklch(0.78 0.12 200)" : "oklch(0.45 0.12 200)",
    },
  ])

  return [editorTheme, syntaxHighlighting(highlightStyle)]
}

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  placeholder?: string
}

export function SqlEditor({
  value,
  onChange,
  onExecute,
  placeholder = "Enter your SQL query...",
}: SqlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onExecuteRef = useRef(onExecute)

  onChangeRef.current = onChange
  onExecuteRef.current = onExecute

  const getIsDark = useCallback(() => {
    return document.documentElement.classList.contains("dark")
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const isDark = getIsDark()

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        sql({ dialect: PostgreSQL }),
        themeCompartment.of(createTheme(isDark)),
        phExtension(placeholder),
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onExecuteRef.current()
              return true
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Only create editor once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  // Watch for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const view = viewRef.current
      if (!view) return
      const isDark = getIsDark()
      view.dispatch({
        effects: themeCompartment.reconfigure(createTheme(isDark)),
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [getIsDark])

  return <div ref={containerRef} className="overflow-hidden rounded-lg" />
}
