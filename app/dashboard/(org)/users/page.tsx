"use client"

import { useState } from "react"
import { usePgUsers } from "@/hooks/use-pg-users"
import { useDatabases } from "@/hooks/use-databases"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import {
  Users,
  Plus,
  MoreVertical,
  Trash2,
  Shield,
  Database,
  Edit,
  Loader2,
} from "lucide-react"

export default function UsersPage() {
  const { users, loading, addUser, deleteUser, updateUser, grantAccess, revokeAccess } = usePgUsers()
  const { databases } = useDatabases()
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newCanLogin, setNewCanLogin] = useState(true)
  const [newSuperuser, setNewSuperuser] = useState(false)
  const [newDatabases, setNewDatabases] = useState<string[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)

  const handleCreate = () => {
    if (newUsername) {
      addUser({
        username: newUsername,
        password: newPassword || "changeme",
        canLogin: newCanLogin,
        superuser: newSuperuser,
      })
      setNewUsername("")
      setNewPassword("")
      setNewCanLogin(true)
      setNewSuperuser(false)
      setNewDatabases([])
      setIsCreateOpen(false)
    }
  }

  const toggleDatabase = (dbName: string) => {
    setNewDatabases((prev) =>
      prev.includes(dbName)
        ? prev.filter((d) => d !== dbName)
        : [...prev, dbName]
    )
  }

  const currentEditingUser = users.find((u) => u.username === editingUser)

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage PostgreSQL users and their database access
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new PostgreSQL user with specific permissions
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="new_user"
                  className="bg-input border-border"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="changeme"
                  className="bg-input border-border"
                />
              </Field>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Can Login</p>
                  <p className="text-xs text-muted-foreground">
                    Allow this user to connect
                  </p>
                </div>
                <Switch checked={newCanLogin} onCheckedChange={setNewCanLogin} />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Superuser</p>
                  <p className="text-xs text-muted-foreground">
                    Grant all privileges
                  </p>
                </div>
                <Switch checked={newSuperuser} onCheckedChange={setNewSuperuser} />
              </div>
              <Field>
                <FieldLabel>Database Access</FieldLabel>
                <div className="mt-2 space-y-2">
                  {databases.map((db) => (
                    <label
                      key={db.name}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    >
                      <Checkbox
                        checked={newDatabases.includes(db.name)}
                        onCheckedChange={() => toggleDatabase(db.name)}
                      />
                      <Database className="w-4 h-4 text-primary" />
                      <span className="text-sm font-mono">{db.name}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={!newUsername}>
                Create User
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
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-3/10">
                <Shield className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {users.filter((u) => u.superuser).length}
                </p>
                <p className="text-sm text-muted-foreground">Superusers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-2/10">
                <Database className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {users.reduce((acc, u) => acc + u.databases.length, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Access Grants</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">All Users</CardTitle>
          <CardDescription>
            Manage user permissions and database access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading users...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Username
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Role
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Database Access
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.username}
                      className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border border-primary/20">
                            <span className="text-sm font-medium text-primary">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-foreground font-mono">
                            {user.username}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {user.superuser && (
                            <Badge variant="default" className="bg-chart-3/20 text-chart-3 border-chart-3/30">
                              Superuser
                            </Badge>
                          )}
                          {user.can_login ? (
                            <Badge variant="outline" className="text-primary border-primary/30">
                              Can Login
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              No Login
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.databases.slice(0, 3).map((db) => (
                            <Badge
                              key={db}
                              variant="secondary"
                              className="text-xs font-mono"
                            >
                              {db}
                            </Badge>
                          ))}
                          {user.databases.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{user.databases.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog
                            open={editingUser === user.username}
                            onOpenChange={(open) =>
                              setEditingUser(open ? user.username : null)
                            }
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-2">
                                <Edit className="w-4 h-4" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-card border-border">
                              <DialogHeader>
                                <DialogTitle>Edit User: {currentEditingUser?.username}</DialogTitle>
                                <DialogDescription>
                                  Modify user permissions and database access
                                </DialogDescription>
                              </DialogHeader>
                              {currentEditingUser && (
                                <FieldGroup>
                                  <div className="flex items-center justify-between py-2">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">
                                        Can Login
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Allow this user to connect
                                      </p>
                                    </div>
                                    <Switch
                                      checked={currentEditingUser.can_login}
                                      onCheckedChange={(checked) =>
                                        updateUser(user.username, { canLogin: checked })
                                      }
                                    />
                                  </div>
                                  <div className="flex items-center justify-between py-2">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">
                                        Superuser
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Grant all privileges
                                      </p>
                                    </div>
                                    <Switch
                                      checked={currentEditingUser.superuser}
                                      onCheckedChange={(checked) =>
                                        updateUser(user.username, { superuser: checked })
                                      }
                                    />
                                  </div>
                                  <Field>
                                    <FieldLabel>Database Access</FieldLabel>
                                    <div className="mt-2 space-y-2">
                                      {databases.map((db) => (
                                        <label
                                          key={db.name}
                                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                                        >
                                          <Checkbox
                                            checked={currentEditingUser.databases.includes(
                                              db.name
                                            )}
                                            onCheckedChange={(checked) =>
                                              checked
                                                ? grantAccess(user.username, db.name)
                                                : revokeAccess(user.username, db.name)
                                            }
                                          />
                                          <Database className="w-4 h-4 text-primary" />
                                          <span className="text-sm font-mono">
                                            {db.name}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </Field>
                                </FieldGroup>
                              )}
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button>Done</Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => deleteUser(user.username)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete User
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
