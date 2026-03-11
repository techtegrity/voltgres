"use client"

import { useState, use } from "react"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Users, Plus, Shield, UserMinus, Key } from "lucide-react"

export default function DatabaseUsersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const { users, grantAccess, revokeAccess } = usePgUsers()

  const [isGrantOpen, setIsGrantOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState("")

  const dbUsers = users.filter((u) => u.databases.includes(dbName))
  const availableUsers = users.filter((u) => !u.databases.includes(dbName))

  const handleGrantAccess = () => {
    if (selectedUser) {
      grantAccess(selectedUser, dbName)
      setSelectedUser("")
      setIsGrantOpen(false)
    }
  }

  const handleRevokeAccess = (username: string) => {
    revokeAccess(username, dbName)
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage user access to {dbName}
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
                Select a user to grant access to {dbName}
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

      {/* Users List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Users with Access</CardTitle>
          <CardDescription>
            {dbUsers.length} user{dbUsers.length !== 1 ? "s" : ""} can access this database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dbUsers.length > 0 ? (
            <div className="space-y-3">
              {dbUsers.map((user) => (
                <div
                  key={user.username}
                  className="flex items-center justify-between p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20">
                      <span className="text-sm font-medium text-primary">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{user.username}</p>
                        {user.superuser && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Shield className="w-3 h-3" />
                            Superuser
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {user.can_login ? "Can login" : "Cannot login"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive gap-2"
                      onClick={() => handleRevokeAccess(user.username)}
                    >
                      <UserMinus className="w-4 h-4" />
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No users have access to this database</p>
              <p className="text-sm mt-1">Grant access to users to allow them to connect</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
