"use client"

import { useState, useEffect, useCallback, use } from "react"
import { api, type DatabaseUserPrivileges } from "@/lib/api-client"
import { usePgUsers } from "@/hooks/use-pg-users"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Shield,
  Plus,
  UserMinus,
  Loader2,
  Crown,
  ShieldCheck,
  Link2,
  Blocks,
  Clock,
  Info,
} from "lucide-react"

const PRIVILEGES = [
  {
    key: "connect" as const,
    label: "Connect",
    icon: Link2,
    description: "Can connect to this database",
  },
  {
    key: "create" as const,
    label: "Create",
    icon: Blocks,
    description: "Can create schemas and objects",
  },
  {
    key: "temporary" as const,
    label: "Temporary",
    icon: Clock,
    description: "Can create temporary tables",
  },
]

export default function DatabaseAccessControlPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const { users } = usePgUsers()

  const [privileges, setPrivileges] = useState<DatabaseUserPrivileges[]>([])
  const [loading, setLoading] = useState(true)
  const [isGrantOpen, setIsGrantOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState("")
  const [toggling, setToggling] = useState<string | null>(null)

  const loadPrivileges = useCallback(async () => {
    try {
      const data = await api.databases.privileges(dbName)
      setPrivileges(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [dbName])

  useEffect(() => {
    loadPrivileges()
  }, [loadPrivileges])

  // Users that don't yet have any access to this database
  const usersWithAccess = privileges.map((p) => p.username)
  const availableUsers = users.filter(
    (u) => !usersWithAccess.includes(u.username) && !u.superuser
  )

  const handleGrantAccess = async () => {
    if (!selectedUser) return
    try {
      // Grant CONNECT + CREATE (full access) by default
      await api.databases.updatePrivilege(dbName, {
        username: selectedUser,
        privilege: "CONNECT",
        action: "grant",
      })
      await api.databases.updatePrivilege(dbName, {
        username: selectedUser,
        privilege: "CREATE",
        action: "grant",
      })
      await api.databases.updatePrivilege(dbName, {
        username: selectedUser,
        privilege: "TEMPORARY",
        action: "grant",
      })
      setSelectedUser("")
      setIsGrantOpen(false)
      await loadPrivileges()
    } catch {
      // ignore
    }
  }

  const handleRevokeAll = async (username: string) => {
    setToggling(username)
    try {
      for (const priv of PRIVILEGES) {
        await api.databases.updatePrivilege(dbName, {
          username,
          privilege: priv.key.toUpperCase(),
          action: "revoke",
        })
      }
      await loadPrivileges()
    } finally {
      setToggling(null)
    }
  }

  const handleTogglePrivilege = async (
    username: string,
    privilege: string,
    currentValue: boolean
  ) => {
    const key = `${username}:${privilege}`
    setToggling(key)
    try {
      await api.databases.updatePrivilege(dbName, {
        username,
        privilege: privilege.toUpperCase(),
        action: currentValue ? "revoke" : "grant",
      })
      await loadPrivileges()
    } finally {
      setToggling(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Split into categories for display
  const owner = privileges.find((p) => p.is_owner)
  const superusers = privileges.filter((p) => p.superuser && !p.is_owner)
  const regularUsers = privileges.filter((p) => !p.is_owner && !p.superuser)

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Access Control</h1>
          <p className="text-muted-foreground mt-1">
            Manage who can access <span className="font-mono">{dbName}</span> and what they can do
          </p>
        </div>
        <Dialog open={isGrantOpen} onOpenChange={setIsGrantOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={availableUsers.length === 0}>
              <Plus className="w-4 h-4" />
              Grant Access
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle>Grant Database Access</DialogTitle>
              <DialogDescription>
                Select a user to grant full access to {dbName}. You can adjust
                individual privileges after granting.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel>User</FieldLabel>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.username} value={user.username}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleGrantAccess} disabled={!selectedUser}>
                Grant Access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Privilege Legend */}
      <div className="flex flex-wrap gap-4 mb-6 text-xs text-muted-foreground">
        {PRIVILEGES.map((p) => (
          <div key={p.key} className="flex items-center gap-1.5">
            <p.icon className="w-3.5 h-3.5" />
            <span className="font-medium">{p.label}</span>
            <span>— {p.description}</span>
          </div>
        ))}
      </div>

      {/* Owner */}
      {owner && (
        <Card className="bg-card border-border mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              <CardTitle className="text-sm">Database Owner</CardTitle>
            </div>
            <CardDescription className="text-xs">
              The owner has full unrestricted access. Change ownership in database settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <span className="text-sm font-medium text-amber-600">
                    {owner.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground font-mono text-sm">{owner.username}</p>
                  <p className="text-xs text-muted-foreground">Full privileges (owner)</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                {PRIVILEGES.map((p) => (
                  <Badge key={p.key} variant="secondary" className="text-xs gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                    <p.icon className="w-3 h-3" />
                    {p.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Superusers */}
      {superusers.length > 0 && (
        <Card className="bg-card border-border mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm">Superusers</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Superusers bypass all privilege checks and always have full access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {superusers.map((user) => (
                <div
                  key={user.username}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border border-primary/20">
                      <span className="text-sm font-medium text-primary">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground font-mono text-sm">{user.username}</p>
                      <p className="text-xs text-muted-foreground">All privileges (superuser)</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Superuser
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regular Users */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm">User Privileges</CardTitle>
          </div>
          <CardDescription className="text-xs">
            {regularUsers.length} user{regularUsers.length !== 1 ? "s" : ""} with
            explicit access. Toggle individual privileges per user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {regularUsers.length > 0 ? (
            <TooltipProvider>
              <div className="space-y-2">
                {regularUsers.map((user) => (
                  <div
                    key={user.username}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted border border-border">
                        <span className="text-sm font-medium text-muted-foreground">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground font-mono text-sm">
                            {user.username}
                          </p>
                          {!user.can_login && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              No login
                            </Badge>
                          )}
                        </div>
                        {user.connection_limit >= 0 && (
                          <p className="text-xs text-muted-foreground">
                            Connection limit: {user.connection_limit}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Privilege toggles */}
                      {PRIVILEGES.map((priv) => {
                        const isActive = user[priv.key]
                        const isToggling = toggling === `${user.username}:${priv.key}`
                        return (
                          <Tooltip key={priv.key}>
                            <TooltipTrigger asChild>
                              <Button
                                variant={isActive ? "default" : "outline"}
                                size="sm"
                                className={`gap-1 h-7 text-xs ${
                                  isActive
                                    ? "bg-primary/90 hover:bg-primary/70"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                                disabled={isToggling}
                                onClick={() =>
                                  handleTogglePrivilege(
                                    user.username,
                                    priv.key,
                                    isActive
                                  )
                                }
                              >
                                {isToggling ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <priv.icon className="w-3 h-3" />
                                )}
                                {priv.label}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {isActive ? "Revoke" : "Grant"} {priv.label}: {priv.description}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}

                      {/* Revoke all */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-muted-foreground hover:text-destructive gap-1 text-xs ml-1"
                            disabled={toggling === user.username}
                            onClick={() => handleRevokeAll(user.username)}
                          >
                            {toggling === user.username ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserMinus className="w-3 h-3" />
                            )}
                            Revoke
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Revoke all access to this database</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
          ) : (
            <div className="py-8 text-center text-muted-foreground border border-dashed border-border rounded-lg">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No users have been granted explicit access</p>
              <p className="text-xs mt-1">
                Use the &ldquo;Grant Access&rdquo; button to add users
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info footer */}
      <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>
          These are PostgreSQL database-level privileges. Superusers and the database
          owner always have full access regardless of these settings. To manage which
          users exist on this server, go to the global{" "}
          <span className="font-medium text-foreground/70">Users</span> page.
        </p>
      </div>
    </div>
  )
}
