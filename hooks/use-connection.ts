"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type ConnectionConfigData, type ServerInfo } from "@/lib/api-client"

export function useConnection() {
  const [config, setConfig] = useState<ConnectionConfigData | null>(null)
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.config.getConnection()
      setConfig(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshServerInfo = useCallback(async () => {
    try {
      const info = await api.server.info()
      setServerInfo(info)
    } catch {
      setServerInfo(null)
    }
  }, [])

  useEffect(() => {
    refresh()
    refreshServerInfo()
  }, [refresh, refreshServerInfo])

  const updateConnection = useCallback(
    async (data: ConnectionConfigData) => {
      await api.config.updateConnection(data)
      setConfig(data)
      await refreshServerInfo()
    },
    [refreshServerInfo]
  )

  const testConnection = useCallback(
    async (data: {
      host: string
      port: number
      username: string
      password: string
      ssl?: boolean
    }) => {
      return api.config.testConnection(data)
    },
    []
  )

  return {
    config,
    serverInfo,
    loading,
    error,
    refresh,
    refreshServerInfo,
    updateConnection,
    testConnection,
  }
}
