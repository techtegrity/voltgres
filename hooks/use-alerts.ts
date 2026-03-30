"use client"

import { useState, useEffect, useCallback } from "react"

export interface Alert {
  id: string
  type: string
  roleName: string | null
  message: string
  currentValue: number
  threshold: number
  resolved: boolean
  resolvedAt: string | null
  createdAt: string
}

export function useAlerts(pollInterval = 30000) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts")
      if (res.ok) {
        setAlerts(await res.json())
      }
    } catch {
      // silently ignore — monitor may not have run yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, pollInterval)
    return () => clearInterval(interval)
  }, [refresh, pollInterval])

  const resolve = useCallback(async (id: string) => {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return { alerts, loading, refresh, resolve }
}
