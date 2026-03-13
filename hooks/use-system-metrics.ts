"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { api, type SystemMetrics } from "@/lib/api-client"

const MAX_HISTORY = 60 // keep last 60 data points

export interface MetricsSnapshot {
  cpuPercent: number
  memPercent: number
  timestamp: number
}

export function useSystemMetrics(intervalMs = 5000) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [history, setHistory] = useState<MetricsSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.system.metrics()
      setMetrics(data)
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            cpuPercent: data.cpu.usagePercent,
            memPercent: data.memory.usagePercent,
            timestamp: data.timestamp,
          },
        ]
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
      })
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    if (intervalMs > 0) {
      timerRef.current = setInterval(refresh, intervalMs)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [refresh, intervalMs])

  return { metrics, history, loading, error, refresh }
}
