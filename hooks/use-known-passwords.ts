"use client"

import { useState, useCallback, useEffect } from "react"
import { api } from "@/lib/api-client"

/**
 * Stores PG user passwords server-side (encrypted at rest) so they persist
 * across browser sessions. Also keeps a local in-memory cache for immediate
 * access during the current session.
 */
export function useKnownPasswords() {
  const [passwords, setPasswords] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  // Fetch persisted passwords from the server on mount
  useEffect(() => {
    api.userPasswords
      .list()
      .then((serverPasswords) => {
        setPasswords((prev) => ({ ...serverPasswords, ...prev }))
        setLoaded(true)
      })
      .catch(() => {
        setLoaded(true)
      })
  }, [])

  const setPassword = useCallback((username: string, password: string) => {
    // Update local state immediately
    setPasswords((prev) => ({ ...prev, [username]: password }))
    // Persist to server (fire-and-forget)
    api.userPasswords.save(username, password).catch(() => {
      // Silently fail — the local cache still works for this session
    })
  }, [])

  const getPassword = useCallback(
    (username: string): string | null => {
      return passwords[username] ?? null
    },
    [passwords]
  )

  return { passwords, setPassword, getPassword, loaded }
}
