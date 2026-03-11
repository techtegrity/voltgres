"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type TableRow, type ColumnRow } from "@/lib/api-client"

export function useTables(dbName: string) {
  const [tables, setTables] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!dbName) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.tables.list(dbName)
      setTables(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dbName])

  useEffect(() => {
    refresh()
  }, [refresh])

  const getColumns = useCallback(
    async (schema: string, table: string): Promise<ColumnRow[]> => {
      return api.tables.columns(dbName, schema, table)
    },
    [dbName]
  )

  return { tables, loading, error, refresh, getColumns }
}
