"use client"

import { useState, useCallback } from "react"

const STORAGE_KEY = "voltgres:known-passwords"

function load(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}")
  } catch {
    return {}
  }
}

function save(data: Record<string, string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded — ignore
  }
}

/**
 * Stores user passwords in sessionStorage so they survive
 * page navigations but are cleared when the browser tab closes.
 */
export function useKnownPasswords() {
  const [passwords, setPasswords] = useState<Record<string, string>>(load)

  const setPassword = useCallback((username: string, password: string) => {
    setPasswords((prev) => {
      const next = { ...prev, [username]: password }
      save(next)
      return next
    })
  }, [])

  const getPassword = useCallback(
    (username: string): string | null => {
      return passwords[username] ?? null
    },
    [passwords]
  )

  return { passwords, setPassword, getPassword }
}
