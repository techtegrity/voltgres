"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type PgUserRow, type UserDatabasePrivileges } from "@/lib/api-client"

export type PrivilegesByUser = Record<string, UserDatabasePrivileges[]>

export function usePgUsers(dbFilter?: string) {
  const [users, setUsers] = useState<PgUserRow[]>([])
  const [privileges, setPrivileges] = useState<PrivilegesByUser>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, privData] = await Promise.all([
        api.users.list(),
        api.users.privileges(),
      ])
      if (dbFilter) {
        setUsers(data.filter((u) => u.databases.includes(dbFilter)))
      } else {
        setUsers(data)
      }
      // Group privileges by username
      const grouped: PrivilegesByUser = {}
      for (const p of privData) {
        if (!grouped[p.username]) grouped[p.username] = []
        grouped[p.username].push(p)
      }
      setPrivileges(grouped)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dbFilter])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addUser = useCallback(
    async (data: {
      username: string
      password: string
      superuser?: boolean
      canLogin?: boolean
    }) => {
      await api.users.create(data)
      await refresh()
    },
    [refresh]
  )

  const deleteUser = useCallback(
    async (username: string) => {
      await api.users.delete(username)
      await refresh()
    },
    [refresh]
  )

  const updateUser = useCallback(
    async (
      username: string,
      data: {
        canLogin?: boolean
        superuser?: boolean
        password?: string
        grantDatabase?: string
        revokeDatabase?: string
      }
    ) => {
      await api.users.update(username, data)
      await refresh()
    },
    [refresh]
  )

  const grantAccess = useCallback(
    async (username: string, dbName: string) => {
      await api.users.update(username, { grantDatabase: dbName })
      await refresh()
    },
    [refresh]
  )

  const revokeAccess = useCallback(
    async (username: string, dbName: string) => {
      await api.users.update(username, { revokeDatabase: dbName })
      await refresh()
    },
    [refresh]
  )

  return {
    users,
    privileges,
    loading,
    error,
    refresh,
    addUser,
    deleteUser,
    updateUser,
    grantAccess,
    revokeAccess,
  }
}
