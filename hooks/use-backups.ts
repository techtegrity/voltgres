"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type BackupConfigData } from "@/lib/api-client"

export function useBackups(dbFilter?: string) {
  const [backups, setBackups] = useState<BackupConfigData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.backups.list()
      if (dbFilter) {
        setBackups(data.filter((b) => b.databases.includes(dbFilter)))
      } else {
        setBackups(data)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dbFilter])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addBackup = useCallback(
    async (data: {
      name: string
      type: string
      schedule: string
      enabled?: boolean
      databases: string[]
      destination: string
      pruningEnabled?: boolean
      retentionKeepLast?: number
      retentionThinKeepEvery?: number
    }) => {
      await api.backups.create(data)
      await refresh()
    },
    [refresh]
  )

  const updateBackup = useCallback(
    async (id: string, data: Partial<BackupConfigData>) => {
      await api.backups.update(id, data)
      await refresh()
    },
    [refresh]
  )

  const deleteBackup = useCallback(
    async (id: string) => {
      await api.backups.delete(id)
      await refresh()
    },
    [refresh]
  )

  return { backups, loading, error, refresh, addBackup, updateBackup, deleteBackup }
}
