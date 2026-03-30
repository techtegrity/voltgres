"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { api } from "@/lib/api-client"

export interface ConnectionSnapshot {
  time: string // HH:MM:SS
  total: number
  active: number
  idle: number
}

const MAX_POINTS = 60 // keep last 60 data points

export function useConnectionHistory(dbName: string, intervalMs = 10_000) {
  const [history, setHistory] = useState<ConnectionSnapshot[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sample = useCallback(async () => {
    try {
      const conns = await api.databases.activity(dbName)
      const now = new Date()
      const time = now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      const active = conns.filter((c: { state: string | null }) => c.state === "active").length
      const idle = conns.filter((c: { state: string | null }) => c.state !== "active").length
      setHistory((prev) => {
        const next = [...prev, { time, total: conns.length, active, idle }]
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next
      })
    } catch {
      // silently skip failed samples
    }
  }, [dbName])

  useEffect(() => {
    sample() // initial
    intervalRef.current = setInterval(sample, intervalMs)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sample, intervalMs])

  return { history }
}
