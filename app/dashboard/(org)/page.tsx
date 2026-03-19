"use client"

import { useState, useRef, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDatabases } from "@/hooks/use-databases"
import { usePgUsers } from "@/hooks/use-pg-users"
import { useConnection } from "@/hooks/use-connection"
import { useKnownPasswords } from "@/hooks/use-known-passwords"
import { useBackups } from "@/hooks/use-backups"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { ConnectionModal } from "@/components/connection-modal"
import { DeleteDatabaseDialog } from "@/components/delete-database-dialog"
import { ServerMetrics } from "@/components/server-metrics"
import { generatePassword } from "@/lib/generate-password"
import { api } from "@/lib/api-client"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Database,
  Plus,
  MoreVertical,
  Trash2,
  Copy,
  Link,
  Loader2,
  UserPlus,
  Users,
  CheckCircle2,
  Activity,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertTriangle,
  CloudOff,
  Cloud,
} from "lucide-react"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return String(n)
}

export default function DatabasesPage() {
  const router = useRouter()
  const { databases, loading, addDatabase, refresh } = useDatabases()
  const { users, addUser, refresh: refreshUsers } = usePgUsers()
  const { config } = useConnection()
  const { backups: allBackupConfigs } = useBackups()

  // Build a map: dbName -> has at least one enabled backup schedule
  const backupStatus = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const cfg of allBackupConfigs) {
      if (cfg.enabled) {
        for (const dbName of cfg.databases) {
          map[dbName] = true
        }
      }
    }
    return map
  }, [allBackupConfigs])

  const [newDbName, setNewDbName] = useState("")
  const [newDbOwner, setNewDbOwner] = useState("")
  const [newDbEncoding, setNewDbEncoding] = useState("UTF8")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [connectionModalDb, setConnectionModalDb] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; owner: string } | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Ownership issue tracking
  const [ownershipIssues, setOwnershipIssues] = useState<Record<string, number>>({})
  useEffect(() => {
    if (databases.length === 0) return
    const checkAll = async () => {
      const results = await Promise.allSettled(
        databases.map(async (db) => {
          const res = await api.databases.checkOwnership(db.name)
          return { name: db.name, count: res.misconfiguredCount }
        })
      )
      const issues: Record<string, number> = {}
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.count > 0) {
          issues[r.value.name] = r.value.count
        }
      }
      setOwnershipIssues(issues)
    }
    checkAll()
  }, [databases])

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const sortedDatabases = useMemo(() => {
    const sorted = [...databases].sort((a, b) => {
      let cmp = 0
      switch (sortColumn) {
        case "name":
          cmp = a.name.localeCompare(b.name)
          break
        case "owner":
          cmp = a.owner.localeCompare(b.owner)
          break
        case "size":
          cmp = a.size_bytes - b.size_bytes
          break
        case "conns":
          cmp = a.active_connections - b.active_connections
          break
        case "transactions":
          cmp = (a.xact_commit + a.xact_rollback) - (b.xact_commit + b.xact_rollback)
          break
        case "cache":
          cmp = Number(a.cache_hit_ratio) - Number(b.cache_hit_ratio)
          break
        case "reads":
          cmp = a.tup_fetched - b.tup_fetched
          break
        case "writes":
          cmp = (a.tup_inserted + a.tup_updated + a.tup_deleted) - (b.tup_inserted + b.tup_updated + b.tup_deleted)
          break
        default:
          cmp = 0
      }
      return sortDirection === "asc" ? cmp : -cmp
    })
    return sorted
  }, [databases, sortColumn, sortDirection])

  // Track passwords for recently created users (sessionStorage-backed)
  const { passwords: knownPasswords, setPassword: setKnownPassword } = useKnownPasswords()

  // New user creation state — default to creating a new user
  const [createNewUser, setCreateNewUser] = useState(true)
  const [newUsername, setNewUsername] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const usernameManuallyEdited = useRef(false)

  const handleDbNameChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, "_")
    setNewDbName(sanitized)
    if (createNewUser && !usernameManuallyEdited.current) {
      setNewUsername(sanitized ? `${sanitized}_user` : "")
    }
  }

  const handleUsernameChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, "_")
    setNewUsername(sanitized)
    usernameManuallyEdited.current = true
  }

  const resetForm = () => {
    setNewDbName("")
    setNewDbOwner("")
    setNewDbEncoding("UTF8")
    setCreateNewUser(true)
    setNewUsername("")
    setNewUserPassword(generatePassword())
    usernameManuallyEdited.current = false
    setCopiedPassword(false)
    setCreateError(null)
  }

  const handleCreateOpenChange = (open: boolean) => {
    setIsCreateOpen(open)
    if (open) {
      resetForm()
    }
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(newUserPassword)
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2000)
  }

  const handleCreate = async () => {
    if (!newDbName) return
    setCreateError(null)
    setIsCreating(true)

    try {
      let ownerUsername = newDbOwner

      // Create new user if requested
      if (createNewUser && newUsername) {
        await addUser({
          username: newUsername,
          password: newUserPassword,
          canLogin: true,
        })
        ownerUsername = newUsername
        // Remember the password so the connection modal can use it
        setKnownPassword(newUsername, newUserPassword)
      }

      await addDatabase({
        name: newDbName,
        owner: ownerUsername || "postgres",
        encoding: newDbEncoding,
      })

      // Refresh users so their databases arrays include the newly created database
      await refreshUsers()

      setIsCreateOpen(false)
    } catch (err) {
      setCreateError((err as Error).message || "Failed to create database")
    } finally {
      setIsCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Databases</h1>
          <p className="text-muted-foreground mt-1">
            Manage your PostgreSQL databases
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={handleCreateOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Database
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Database</DialogTitle>
              <DialogDescription>
                Create a new PostgreSQL database with a dedicated user
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="db-name">Database Name</FieldLabel>
                <Input
                  id="db-name"
                  value={newDbName}
                  onChange={(e) => handleDbNameChange(e.target.value)}
                  placeholder="my_database"
                  className="bg-input border-border font-mono"
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="db-encoding">Encoding</FieldLabel>
                <Select value={newDbEncoding} onValueChange={setNewDbEncoding}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTF8">UTF8</SelectItem>
                    <SelectItem value="LATIN1">LATIN1</SelectItem>
                    <SelectItem value="SQL_ASCII">SQL_ASCII</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Owner: New user / Existing user toggle */}
              <div className="border-t border-border pt-4 mt-2">
                <FieldLabel className="mb-3">Owner</FieldLabel>
                <div className="flex gap-2 mb-4">
                  <Button
                    type="button"
                    variant={createNewUser ? "default" : "outline"}
                    size="sm"
                    className="gap-2 flex-1"
                    onClick={() => {
                      setCreateNewUser(true)
                      setNewDbOwner("")
                      if (!usernameManuallyEdited.current && newDbName) {
                        setNewUsername(`${newDbName}_user`)
                      }
                    }}
                  >
                    <UserPlus className="w-4 h-4" />
                    New user
                  </Button>
                  <Button
                    type="button"
                    variant={!createNewUser ? "default" : "outline"}
                    size="sm"
                    className="gap-2 flex-1"
                    disabled={users.length === 0}
                    onClick={() => {
                      setCreateNewUser(false)
                      setNewUsername("")
                    }}
                  >
                    <Users className="w-4 h-4" />
                    Existing user
                  </Button>
                </div>

                {createNewUser ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="new-username">Username</FieldLabel>
                      <Input
                        id="new-username"
                        value={newUsername}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="app_user"
                        className="bg-input border-border font-mono"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="new-password">Password</FieldLabel>
                      <div className="flex gap-2">
                        <Input
                          id="new-password"
                          type="text"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="bg-input border-border font-mono text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={copyPassword}
                        >
                          {copiedPassword ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Save this password securely. You won't be able to view it again.
                      </p>
                    </Field>
                  </>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="db-owner">Select user</FieldLabel>
                    <Select value={newDbOwner} onValueChange={setNewDbOwner}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.username} value={user.username}>
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
            </FieldGroup>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isCreating}>Cancel</Button>
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !newDbName || (createNewUser ? !newUsername || !newUserPassword : !newDbOwner)}
              >
                {isCreating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isCreating ? "Creating..." : "Create Database"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connection Modal */}
      <ConnectionModal
        open={connectionModalDb !== null}
        onOpenChange={(open) => !open && setConnectionModalDb(null)}
        databases={databases}
        users={users}
        initialDatabase={connectionModalDb || undefined}
        adminUsername={config?.username}
        knownPasswords={knownPasswords}
        onUsersRefresh={refreshUsers}
        onPasswordReset={(username, password) =>
          setKnownPassword(username, password)
        }
      />

      {/* Delete Database Dialog */}
      <DeleteDatabaseDialog
        dbName={deleteTarget?.name ?? ""}
        owner={deleteTarget?.owner ?? null}
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        onDeleted={() => { setDeleteTarget(null); refresh() }}
      />

      {/* Server Metrics */}
      <div className="mb-6">
        <ServerMetrics />
      </div>

      {/* Database List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">All Databases</CardTitle>
          <CardDescription>
            Click on a database to open its detail view with SQL editor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {[
                    { key: "name", label: "Name", className: "" },
                    { key: "size", label: "Size", className: "" },
                    { key: "conns", label: "Conns", className: "hidden sm:table-cell" },
                    { key: "transactions", label: "Transactions", className: "hidden lg:table-cell" },
                    { key: "cache", label: "Cache Hit", className: "hidden lg:table-cell" },
                    { key: "reads", label: "Reads", className: "hidden xl:table-cell" },
                    { key: "writes", label: "Writes", className: "hidden xl:table-cell" },
                    { key: "backups", label: "Backups", className: "hidden lg:table-cell" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className={`text-left py-3 px-4 text-sm font-medium text-muted-foreground select-none cursor-pointer hover:text-foreground transition-colors ${col.className}`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortColumn === col.key ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDatabases.map((db) => (
                  <tr
                    key={db.name}
                    className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/databases/${encodeURIComponent(db.name)}`)}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-primary/10">
                          <Database className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground font-mono flex items-center gap-1.5">
                            {db.name}
                            {ownershipIssues[db.name] && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{ownershipIssues[db.name]} table{ownershipIssues[db.name] > 1 ? "s" : ""} owned by postgres — fix in Settings</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {db.owner}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">
                      {formatBytes(db.size_bytes)}
                    </td>
                    <td className="py-4 px-4 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1.5 text-sm ${db.active_connections > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                        {db.active_connections > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        )}
                        {db.active_connections}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground hidden lg:table-cell">
                      <span title={`${db.xact_commit.toLocaleString()} commits / ${db.xact_rollback.toLocaleString()} rollbacks`}>
                        {formatCompact(db.xact_commit + db.xact_rollback)}
                      </span>
                    </td>
                    <td className="py-4 px-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              Number(db.cache_hit_ratio) >= 95 ? "bg-green-500" :
                              Number(db.cache_hit_ratio) >= 80 ? "bg-yellow-500" :
                              "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(Number(db.cache_hit_ratio), 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {Number(db.cache_hit_ratio)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground hidden xl:table-cell">
                      <span title={`Returned: ${db.tup_returned.toLocaleString()} / Fetched: ${db.tup_fetched.toLocaleString()}`}>
                        {formatCompact(db.tup_fetched)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground hidden xl:table-cell">
                      <span title={`Inserted: ${db.tup_inserted.toLocaleString()} / Updated: ${db.tup_updated.toLocaleString()} / Deleted: ${db.tup_deleted.toLocaleString()}`}>
                        {formatCompact(db.tup_inserted + db.tup_updated + db.tup_deleted)}
                      </span>
                    </td>
                    <td className="py-4 px-4 hidden lg:table-cell">
                      {backupStatus[db.name] ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                          <Cloud className="w-3.5 h-3.5" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CloudOff className="w-3.5 h-3.5" />
                          None
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => setConnectionModalDb(db.name)}
                        >
                          <Link className="w-4 h-4" />
                          <span className="hidden sm:inline">Connect</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget({ name: db.name, owner: db.owner })}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Database
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
