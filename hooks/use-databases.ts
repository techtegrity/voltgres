"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type DatabaseRow } from "@/lib/api-client"

export function useDatabases() {
  const [databases, setDatabases] = useState<DatabaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.databases.list()
      setDatabases(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addDatabase = useCallback(
    async (data: { name: string; owner: string; encoding: string }) => {
      await api.databases.create(data)
      await refresh()
    },
    [refresh]
  )

  const deleteDatabase = useCallback(
    async (name: string) => {
      await api.databases.delete(name)
      await refresh()
    },
    [refresh]
  )

  return { databases, loading, error, refresh, addDatabase, deleteDatabase }
}
