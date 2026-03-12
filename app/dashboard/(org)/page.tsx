"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useDatabases } from "@/hooks/use-databases"
import { usePgUsers } from "@/hooks/use-pg-users"
import { useConnection } from "@/hooks/use-connection"
import { useKnownPasswords } from "@/hooks/use-known-passwords"
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
import { generatePassword } from "@/lib/generate-password"
import {
  Database,
  Plus,
  MoreVertical,
  Trash2,
  Copy,
  Link,
  HardDrive,
  ExternalLink,
  Loader2,
  UserPlus,
  Users,
  CheckCircle2,
} from "lucide-react"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export default function DatabasesPage() {
  const router = useRouter()
  const { databases, loading, addDatabase, deleteDatabase } = useDatabases()
  const { users, addUser, refresh: refreshUsers } = usePgUsers()
  const { config } = useConnection()
  const [newDbName, setNewDbName] = useState("")
  const [newDbOwner, setNewDbOwner] = useState("")
  const [newDbEncoding, setNewDbEncoding] = useState("UTF8")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [connectionModalDb, setConnectionModalDb] = useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

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

  const handleCreateOpenChange = (open: boolean) => {
    setIsCreateOpen(open)
    if (open) {
      // Generate a fresh password when modal opens
      setNewUserPassword(generatePassword())
      setCreateNewUser(true)
      setCreateError(null)
      usernameManuallyEdited.current = false
    } else {
      // Reset form on close
      setNewDbName("")
      setNewDbOwner("")
      setNewDbEncoding("UTF8")
      setCreateNewUser(true)
      setNewUsername("")
      setNewUserPassword("")
      usernameManuallyEdited.current = false
      setCopiedPassword(false)
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{databases.length}</p>
                <p className="text-sm text-muted-foreground">Total Databases</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-2/10">
                <HardDrive className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {formatBytes(databases.reduce((acc, db) => acc + db.size_bytes, 0))}
                </p>
                <p className="text-sm text-muted-foreground">Total Size</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-3/10">
                <Link className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{users.length}</p>
                <p className="text-sm text-muted-foreground">Connected Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection Modal */}
      <ConnectionModal
        open={connectionModalDb !== null}
        onOpenChange={(open) => !open && setConnectionModalDb(null)}
        databases={databases}
        users={users}
        initialDatabase={connectionModalDb || undefined}
        adminPassword={config?.password}
        knownPasswords={knownPasswords}
        onUsersRefresh={refreshUsers}
        onPasswordReset={(username, password) =>
          setKnownPassword(username, password)
        }
      />

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
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Owner
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Encoding
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Size
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {databases.map((db) => (
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
                        <span className="font-medium text-foreground font-mono">
                          {db.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">{db.owner}</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground">
                        {db.encoding}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">
                      {formatBytes(db.size_bytes)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => router.push(`/dashboard/databases/${encodeURIComponent(db.name)}`)}
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="hidden sm:inline">Open</span>
                        </Button>
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
                              onClick={() => deleteDatabase(db.name)}
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
