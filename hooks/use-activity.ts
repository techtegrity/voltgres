"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { api, type ConnectionActivity } from "@/lib/api-client"

export function useActivity(dbName: string, autoRefreshMs = 5000) {
  const [connections, setConnections] = useState<ConnectionActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const data = await api.databases.activity(dbName)
      setConnections(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dbName])

  const terminateConnection = useCallback(
    async (pid: number) => {
      await api.databases.terminateConnection(dbName, pid)
      await refresh()
    },
    [dbName, refresh]
  )

  useEffect(() => {
    refresh()
    if (autoRefreshMs > 0) {
      intervalRef.current = setInterval(refresh, autoRefreshMs)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh, autoRefreshMs])

  return { connections, loading, error, refresh, terminateConnection }
}
