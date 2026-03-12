"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { api, type SnapshotData } from "@/lib/api-client"

export function useSnapshots(dbName: string) {
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.snapshots.list(dbName)
      setSnapshots(data)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dbName])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto-poll when any snapshot is pending or running
  useEffect(() => {
    const hasInProgress = snapshots.some(
      (s) => s.status === "pending" || s.status === "running"
    )

    if (hasInProgress) {
      intervalRef.current = setInterval(refresh, 3000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [snapshots, refresh])

  const createSnapshot = useCallback(
    async (database: string) => {
      await api.snapshots.create(database)
      await refresh()
    },
    [refresh]
  )

  const deleteSnapshot = useCallback(
    async (id: string) => {
      await api.snapshots.delete(id)
      await refresh()
    },
    [refresh]
  )

  return { snapshots, loading, error, refresh, createSnapshot, deleteSnapshot }
}
