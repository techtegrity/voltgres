"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { api } from "@/lib/api-client"

export type Range = "1h" | "1d" | "1w"

export interface ConnectionSnapshot {
  time: string
  total: number
  active: number
  idle: number
}

const REFRESH_INTERVALS: Record<Range, number> = {
  "1h": 30_000,   // 30s
  "1d": 120_000,  // 2min
  "1w": 300_000,  // 5min
}

function formatTime(iso: string, range: Range): string {
  const d = new Date(iso)
  if (range === "1h") {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
  }
  if (range === "1d") {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
  }
  // 1w: show day + time
  return d.toLocaleDateString(undefined, { weekday: "short" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function useConnectionHistory(dbName: string, range: Range = "1h") {
  const [history, setHistory] = useState<ConnectionSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const data = await api.databases.connectionHistory(dbName, range)
      setHistory(
        data.map((d) => ({
          time: formatTime(d.time, range),
          total: d.total,
          active: d.active,
          idle: d.idle,
        }))
      )
    } catch {
      // silently skip
    } finally {
      setLoading(false)
    }
  }, [dbName, range])

  useEffect(() => {
    setLoading(true)
    fetchHistory()
    const ms = REFRESH_INTERVALS[range]
    intervalRef.current = setInterval(fetchHistory, ms)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchHistory, range])

  return { history, loading }
}
