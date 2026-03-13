"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type TablePrivilegeRow } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Loader2,
  ShieldCheck,
  Crown,
  ArrowRightLeft,
  Check,
  X,
} from "lucide-react"

const TABLE_PRIVILEGES = [
  "select",
  "insert",
  "update",
  "delete",
  "truncate",
  "references",
  "trigger",
] as const

type TablePrivKey = (typeof TABLE_PRIVILEGES)[number]

interface Props {
  dbName: string
}

export function TablePrivilegesGrid({ dbName }: Props) {
  const [rows, setRows] = useState<TablePrivilegeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<string>("")
  const [selectedSchema, setSelectedSchema] = useState<string>("public")

  // Transfer ownership dialog state
  const [transferTarget, setTransferTarget] = useState<{
    schema: string
    table: string
    currentOwner: string
  } | null>(null)
  const [transferTo, setTransferTo] = useState("")

  const loadPrivileges = useCallback(async () => {
    try {
      const data = await api.databases.tablePrivileges(dbName)
      setRows(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [dbName])

  useEffect(() => {
    loadPrivileges()
  }, [loadPrivileges])

  // Derive unique users and schemas
  const users = [...new Set(rows.map((r) => r.username))].sort()
  const schemas = [...new Set(rows.map((r) => r.schema))].sort()

  // Auto-select database owner as default user
  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      const dbOwner = rows.find((r) => r.is_table_owner)?.table_owner
      if (dbOwner && users.includes(dbOwner)) {
        setSelectedUser(dbOwner)
      } else {
        setSelectedUser(users[0])
      }
    }
  }, [users, selectedUser, rows])

  // Filter rows for the selected user and schema
  const filteredRows = rows.filter(
    (r) => r.username === selectedUser && r.schema === selectedSchema
  )

  // Get the selected user's info
  const selectedUserInfo = rows.find((r) => r.username === selectedUser)
  const isSuperuser = selectedUserInfo?.superuser ?? false

  // Unique tables in the selected schema (for ownership transfer options)
  const tablesInSchema = [
    ...new Map(
      rows
        .filter((r) => r.schema === selectedSchema)
        .map((r) => [`${r.schema}.${r.table_name}`, r])
    ).values(),
  ]

  const handleToggle = async (
    schema: string,
    table: string,
    privilege: TablePrivKey,
    currentValue: boolean
  ) => {
    const key = `${schema}.${table}.${privilege}`
    setToggling(key)
    try {
      await api.databases.updateTablePrivilege(dbName, {
        username: selectedUser,
        schema,
        table,
        privilege: privilege.toUpperCase(),
        action: currentValue ? "revoke" : "grant",
      })
      await loadPrivileges()
    } finally {
      setToggling(null)
    }
  }

  const handleToggleColumn = async (privilege: TablePrivKey) => {
    if (isSuperuser) return
    // Check if all non-owner tables have this privilege — if so, revoke all; otherwise grant all
    const toggleableRows = filteredRows.filter((r) => !r.is_table_owner)
    if (toggleableRows.length === 0) return
    const allHave = toggleableRows.every((r) => r[privilege])
    const action = allHave ? "revoke" : "grant"

    setToggling(`column:${privilege}`)
    try {
      for (const row of toggleableRows) {
        if ((action === "grant" && !row[privilege]) || (action === "revoke" && row[privilege])) {
          await api.databases.updateTablePrivilege(dbName, {
            username: selectedUser,
            schema: row.schema,
            table: row.table_name,
            privilege: privilege.toUpperCase(),
            action,
          })
        }
      }
      await loadPrivileges()
    } finally {
      setToggling(null)
    }
  }

  const handleTransferOwnership = async () => {
    if (!transferTarget || !transferTo) return
    setToggling("transfer")
    try {
      await api.databases.updateTablePrivilege(dbName, {
        username: transferTo,
        schema: transferTarget.schema,
        table: transferTarget.table,
        action: "transfer_ownership",
      })
      await loadPrivileges()
      setTransferTarget(null)
      setTransferTo("")
    } finally {
      setToggling(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-sm">No tables found in this database</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">User</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[180px] bg-input border-border h-8 text-sm">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => {
                  const info = rows.find((r) => r.username === u)
                  return (
                    <SelectItem key={u} value={u}>
                      <span className="font-mono">{u}</span>
                      {info?.superuser && (
                        <span className="text-muted-foreground ml-1">(superuser)</span>
                      )}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          {schemas.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Schema</label>
              <Select value={selectedSchema} onValueChange={setSelectedSchema}>
                <SelectTrigger className="w-[140px] bg-input border-border h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isSuperuser && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <ShieldCheck className="w-3 h-3" />
              Superuser — all privileges apply
            </Badge>
          )}
        </div>

        {/* Grid */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[200px]">
                    Table
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[120px]">
                    Owner
                  </th>
                  {TABLE_PRIVILEGES.map((priv) => {
                    const toggleableRows = filteredRows.filter((r) => !r.is_table_owner)
                    const allHave = toggleableRows.length > 0 && toggleableRows.every((r) => r[priv])
                    const noneHave = toggleableRows.length > 0 && toggleableRows.every((r) => !r[priv])
                    const isColumnToggling = toggling === `column:${priv}`
                    const canToggle = !isSuperuser && toggleableRows.length > 0 && !toggling

                    return (
                      <th
                        key={priv}
                        className="text-center px-2 py-2 w-[80px]"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={`uppercase text-xs font-medium transition-colors ${
                                canToggle
                                  ? "cursor-pointer hover:text-foreground"
                                  : "cursor-default"
                              } ${
                                allHave
                                  ? "text-primary"
                                  : noneHave
                                    ? "text-muted-foreground/50"
                                    : "text-muted-foreground"
                              }`}
                              disabled={!canToggle}
                              onClick={() => canToggle && handleToggleColumn(priv)}
                            >
                              {isColumnToggling ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                              ) : (
                                priv === "references" ? "Refs" : priv
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {allHave ? "Revoke" : "Grant"} {priv.toUpperCase()} on all tables
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + TABLE_PRIVILEGES.length}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No tables found in schema &quot;{selectedSchema}&quot;
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isOwner = row.is_table_owner
                    return (
                      <tr
                        key={`${row.schema}.${row.table_name}`}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-3 py-2 font-mono text-foreground">
                          {row.table_name}
                        </td>
                        <td className="px-3 py-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 hover:bg-muted border border-transparent hover:border-border transition-colors"
                                onClick={() => {
                                  setTransferTarget({
                                    schema: row.schema,
                                    table: row.table_name,
                                    currentOwner: row.table_owner,
                                  })
                                  setTransferTo("")
                                }}
                              >
                                {row.table_owner === selectedUser ? (
                                  <Crown className="w-3 h-3 text-amber-500" />
                                ) : null}
                                <span className="font-mono text-muted-foreground">
                                  {row.table_owner}
                                </span>
                                <ArrowRightLeft className="w-3 h-3 text-muted-foreground/50" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Transfer ownership</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        {TABLE_PRIVILEGES.map((priv) => {
                          const hasPriv = row[priv]
                          const isToggling =
                            toggling === `${row.schema}.${row.table_name}.${priv}`
                          const disabled = isSuperuser || isOwner || isToggling

                          return (
                            <td key={priv} className="text-center px-2 py-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors ${
                                      hasPriv
                                        ? isSuperuser
                                          ? "bg-primary/20 text-primary/60"
                                          : isOwner
                                            ? "bg-amber-500/20 text-amber-500/80"
                                            : "bg-primary/20 text-primary hover:bg-primary/30"
                                        : "bg-muted text-muted-foreground/30 hover:bg-muted/80 hover:text-muted-foreground"
                                    } ${disabled ? "cursor-default" : "cursor-pointer"}`}
                                    disabled={disabled}
                                    onClick={() =>
                                      !disabled &&
                                      handleToggle(
                                        row.schema,
                                        row.table_name,
                                        priv,
                                        hasPriv
                                      )
                                    }
                                  >
                                    {isToggling ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : hasPriv ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <X className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isSuperuser ? (
                                    <p>Superuser bypasses all checks</p>
                                  ) : isOwner ? (
                                    <p>Owner has implicit privileges</p>
                                  ) : (
                                    <p>
                                      {hasPriv ? "Revoke" : "Grant"}{" "}
                                      {priv.toUpperCase()} on {row.table_name}
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transfer Ownership Dialog */}
        <Dialog
          open={!!transferTarget}
          onOpenChange={(open) => !open && setTransferTarget(null)}
        >
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle>Transfer Table Ownership</DialogTitle>
              <DialogDescription>
                Transfer ownership of{" "}
                <span className="font-mono font-medium">
                  {transferTarget?.schema}.{transferTarget?.table}
                </span>{" "}
                from{" "}
                <span className="font-mono font-medium">
                  {transferTarget?.currentOwner}
                </span>{" "}
                to another user.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                New Owner
              </label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select new owner" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u !== transferTarget?.currentOwner)
                    .map((u) => (
                      <SelectItem key={u} value={u}>
                        <span className="font-mono">{u}</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                onClick={handleTransferOwnership}
                disabled={!transferTo || toggling === "transfer"}
              >
                {toggling === "transfer" && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Transfer Ownership
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
