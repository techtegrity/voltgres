"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type StorageConfigData } from "@/lib/api-client"

export function useStorageConfig() {
  const [config, setConfig] = useState<StorageConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    console.log("[StorageHook] refresh: fetching config...")
    setLoading(true)
    setError(null)
    try {
      const data = await api.storage.get()
      console.log("[StorageHook] refresh: got config", data ? "exists" : "null")
      setConfig(data)
    } catch (err) {
      console.error("[StorageHook] refresh error:", err)
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
      console.log("[StorageHook] save: calling PUT...")
      const result = await api.storage.save(data)
      console.log("[StorageHook] save: PUT result:", result)
      console.log("[StorageHook] save: calling refresh...")
      await refresh()
      console.log("[StorageHook] save: refresh done")
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
