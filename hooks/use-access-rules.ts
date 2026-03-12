"use client"

import { useState, useEffect, useCallback } from "react"

interface AccessRule {
  id: string
  type: "ip" | "cidr" | "header_secret"
  value: string
  description: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export function useAccessRules() {
  const [rules, setRules] = useState<AccessRule[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/config/access-control")
      if (res.ok) {
        setRules(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const addRule = async (rule: { type: string; value: string; description: string }) => {
    const res = await fetch("/api/config/access-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || "Failed to add rule")
    }
    await fetchRules()
  }

  const deleteRule = async (id: string) => {
    await fetch(`/api/config/access-control/${id}`, { method: "DELETE" })
    await fetchRules()
  }

  const toggleRule = async (id: string, enabled: boolean) => {
    await fetch(`/api/config/access-control/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    await fetchRules()
  }

  const getMyIp = async (): Promise<string> => {
    const res = await fetch("/api/config/access-control/my-ip")
    const data = await res.json()
    return data.ip
  }

  return { rules, loading, addRule, deleteRule, toggleRule, getMyIp, refetch: fetchRules }
}
