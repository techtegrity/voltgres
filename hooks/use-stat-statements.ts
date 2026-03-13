"use client"

import { useState, useEffect, useCallback } from "react"
import {
  api,
  type PgStatStatementEntry,
} from "@/lib/api-client"

export function useStatStatements(opts: {
  database?: string
  search?: string
  limit?: number
  autoRefresh?: boolean
} = {}) {
  const { database, search, limit = 100, autoRefresh = false } = opts
  const [entries, setEntries] = useState<PgStatStatementEntry[]>([])
  const [available, setAvailable] = useState(true)
  const [reason, setReason] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const data = await api.statStatements.get({ db: database, search, limit })
      setEntries(data.entries)
      setAvailable(data.available)
      setReason(data.reason)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [database, search, limit])

  useEffect(() => {
    refresh()
    if (autoRefresh) {
      const interval = setInterval(refresh, 15000)
      return () => clearInterval(interval)
    }
  }, [refresh, autoRefresh])

  const enable = useCallback(async () => {
    try {
      await api.statStatements.enable()
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }, [refresh])

  const reset = useCallback(async () => {
    try {
      await api.statStatements.reset()
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }, [refresh])

  return { entries, available, reason, loading, error, refresh, enable, reset }
}
