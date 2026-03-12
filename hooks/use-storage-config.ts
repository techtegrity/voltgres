"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type StorageConfigData } from "@/lib/api-client"

export function useStorageConfig() {
  const [config, setConfig] = useState<StorageConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.storage.get()
      setConfig(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = useCallback(
    async (data: {
      provider: string
      bucket: string
      region?: string
      endpoint?: string
      accessKeyId: string
      secretAccessKey: string
      pathPrefix?: string
    }) => {
      await api.storage.save(data)
      await refresh()
    },
    [refresh]
  )

  const testConnection = useCallback(
    async (data: {
      provider: string
      bucket: string
      region?: string
      endpoint?: string
      accessKeyId: string
      secretAccessKey: string
    }) => {
      return api.storage.test(data)
    },
    []
  )

  const remove = useCallback(async () => {
    await api.storage.delete()
    setConfig(null)
  }, [])

  return { config, loading, error, save, testConnection, remove, refresh }
}
