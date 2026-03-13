"use client"

import { useState, useEffect, useCallback } from "react"
import {
  api,
  type QueryLogEntry,
  type QueryLogDetail,
  type QueryLogStatsEntry,
  type QueryLogConfigData,
} from "@/lib/api-client"

export function useQueryLog(opts: {
  database?: string
  search?: string
  page?: number
  pageSize?: number
  autoRefresh?: boolean
} = {}) {
  const { database, search, page = 1, pageSize = 50, autoRefresh = false } = opts
  const [entries, setEntries] = useState<QueryLogEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const data = await api.queryLog.list({ db: database, search, page, pageSize })
      setEntries(data.entries)
      setTotalCount(data.totalCount)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [database, search, page, pageSize])

  useEffect(() => {
    refresh()
    if (autoRefresh) {
      const interval = setInterval(refresh, 10000)
      return () => clearInterval(interval)
    }
  }, [refresh, autoRefresh])

  return { entries, totalCount, loading, error, refresh }
}

export function useQueryLogDetail(id: string | null) {
  const [entry, setEntry] = useState<QueryLogDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setEntry(null)
      return
    }
    setLoading(true)
    setError(null)
    api.queryLog
      .get(id)
      .then(setEntry)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [id])

  return { entry, loading, error }
}

export function useQueryLogStats() {
  const [stats, setStats] = useState<QueryLogStatsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const data = await api.queryLog.stats()
      setStats(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { stats, loading, error, refresh }
}

export function useQueryLogConfig(database: string) {
  const [config, setConfig] = useState<QueryLogConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const data = await api.queryLog.getConfig(database)
      setConfig(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [database])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateConfig = useCallback(
    async (updates: { enabled?: boolean; retentionDays?: number }) => {
      try {
        const data = await api.queryLog.updateConfig({ database, ...updates })
        setConfig(data)
      } catch (err) {
        setError((err as Error).message)
      }
    },
    [database]
  )

  return { config, loading, error, refresh, updateConfig }
}
