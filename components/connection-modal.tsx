"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { api, type DatabaseRow, type PgUserRow } from "@/lib/api-client"
import { generatePassword } from "@/lib/generate-password"
import {
  Copy,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Database,
  User,
} from "lucide-react"

type ConnectionFormat = "uri" | "parameters" | "env" | "psql"

interface ConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databases: DatabaseRow[]
  users: PgUserRow[]
  initialDatabase?: string
  initialUser?: string
  adminPassword?: string
  /** Map of username → password for recently created users */
  knownPasswords?: Record<string, string>
  onUsersRefresh?: () => void
  onPasswordReset?: (username: string, password: string) => void
}

function buildConnectionString(params: {
  host: string
  port: number
  db: string
  user: string
  password: string
  ssl: boolean
  format: ConnectionFormat
  encodePassword?: boolean
}): string {
  const { host, port, db, user, password, ssl, format, encodePassword = true } = params
  const uriPassword = encodePassword ? encodeURIComponent(password) : password
  const sslParam = ssl ? "?sslmode=require" : ""

  switch (format) {
    case "uri":
      return `postgresql://${user}:${uriPassword}@${host}:${port}/${db}${sslParam}`
    case "parameters":
      return [
        `host=${host}`,
        `port=${port}`,
        `dbname=${db}`,
        `user=${user}`,
        `password=${password}`,
        ssl ? `sslmode=require` : null,
      ]
        .filter(Boolean)
        .join(" ")
    case "env":
      return `DATABASE_URL="postgresql://${user}:${uriPassword}@${host}:${port}/${db}${sslParam}"`
    case "psql":
      return `psql "host=${host} port=${port} dbname=${db} user=${user}${ssl ? " sslmode=require" : ""}"`
  }
}

export function ConnectionModal({
  open,
  onOpenChange,
  databases,
  users,
  initialDatabase,
  initialUser,
  adminPassword,
  knownPasswords,
  onUsersRefresh,
  onPasswordReset,
}: ConnectionModalProps) {
  const [selectedDb, setSelectedDb] = useState(initialDatabase || "")
  const [selectedUser, setSelectedUser] = useState(initialUser || "")
  const userManuallySelected = useRef(false)
  const [format, setFormat] = useState<ConnectionFormat>("uri")
  const [showPassword, setShowPassword] = useState(false)
  const [sslEnabled, setSslEnabled] = useState(false)
  const [copied, setCopied] = useState(false)
  const [publicHost, setPublicHost] = useState("")
  const [publicPort, setPublicPort] = useState(5432)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  // Fetch public connection info on open
  useEffect(() => {
    if (!open) return
    api.config
      .getPublicConnection()
      .then((info) => {
        setPublicHost(info.publicHost || window.location.hostname)
        setPublicPort(info.publicPort)
      })
      .catch(() => {
        setPublicHost(window.location.hostname)
      })
  }, [open])

  // Sync initial values when modal opens
  useEffect(() => {
    if (open) {
      if (initialDatabase) setSelectedDb(initialDatabase)
      if (initialUser) {
        setSelectedUser(initialUser)
      } else {
        // Set best default now; auto-select effect will correct if data loads later
        setSelectedUser(bestDefaultUser)
      }
      userManuallySelected.current = false
      setTempPassword(null)
      setResetSuccess(false)
      setShowPassword(false)
      setCopied(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bestDefaultUser read once on open
  }, [open, initialDatabase, initialUser])

  // Filter users by selected database
  const filteredUsers = useMemo(() => {
    if (!selectedDb) return users
    return users.filter(
      (u) => u.databases.includes(selectedDb) || u.superuser
    )
  }, [users, selectedDb])

  // Pick the best default role for a database:
  // prefer the DB owner, then a non-superuser with explicit access, then first available
  const bestDefaultUser = useMemo(() => {
    if (filteredUsers.length === 0) return ""
    const db = databases.find((d) => d.name === selectedDb)
    // Prefer the DB owner (the role used during creation)
    if (db?.owner) {
      const ownerUser = filteredUsers.find((u) => u.username === db.owner)
      if (ownerUser) return ownerUser.username
    }
    // Fall back to a dedicated (non-superuser) role with access
    const dedicated = filteredUsers.find(
      (u) => !u.superuser && u.databases.includes(selectedDb)
    )
    if (dedicated) return dedicated.username
    return filteredUsers[0].username
  }, [filteredUsers, selectedDb, databases])

  // Auto-select best user when database changes, bestDefaultUser resolves, or
  // current user isn't in the filtered list. Respects manual selection.
  useEffect(() => {
    if (filteredUsers.length === 0) return
    const currentInList = filteredUsers.some((u) => u.username === selectedUser)
    if (!currentInList || !userManuallySelected.current) {
      setSelectedUser(bestDefaultUser)
    }
    setTempPassword(null)
    setResetSuccess(false)
  }, [selectedDb, bestDefaultUser, filteredUsers])

  // Determine the password to display
  const currentPassword = useMemo(() => {
    if (tempPassword) return tempPassword
    if (selectedUser === "postgres" && adminPassword) return adminPassword
    if (knownPasswords?.[selectedUser]) return knownPasswords[selectedUser]
    return null
  }, [tempPassword, selectedUser, adminPassword, knownPasswords])

  const displayPassword = currentPassword
    ? showPassword
      ? currentPassword
      : "****************"
    : "[YOUR-PASSWORD]"

  const connectionString = useMemo(() => {
    if (!selectedDb || !selectedUser || !publicHost) return ""
    return buildConnectionString({
      host: publicHost,
      port: publicPort,
      db: selectedDb,
      user: selectedUser,
      password: displayPassword,
      ssl: sslEnabled,
      format,
      encodePassword: false,
    })
  }, [selectedDb, selectedUser, publicHost, publicPort, displayPassword, sslEnabled, format])

  // For clipboard: always use real password if known, encode only real passwords
  const clipboardString = useMemo(() => {
    if (!selectedDb || !selectedUser || !publicHost) return ""
    const hasReal = currentPassword !== null
    return buildConnectionString({
      host: publicHost,
      port: publicPort,
      db: selectedDb,
      user: selectedUser,
      password: hasReal ? currentPassword : "[YOUR-PASSWORD]",
      ssl: sslEnabled,
      format,
      encodePassword: hasReal,
    })
  }, [selectedDb, selectedUser, publicHost, publicPort, currentPassword, sslEnabled, format])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(clipboardString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [clipboardString])

  const handleResetPassword = useCallback(async () => {
    if (!selectedUser || isResetting) return
    setIsResetting(true)
    setResetSuccess(false)
    try {
      const newPassword = generatePassword()
      await api.users.update(selectedUser, { password: newPassword })
      setTempPassword(newPassword)
      setShowPassword(true)
      setResetSuccess(true)
      onUsersRefresh?.()
      onPasswordReset?.(selectedUser, newPassword)
      setTimeout(() => setResetSuccess(false), 3000)
    } catch {
      // Could add error handling here
    } finally {
      setIsResetting(false)
    }
  }, [selectedUser, isResetting, onUsersRefresh, onPasswordReset])

  const hasPassword = currentPassword !== null
  const psqlNote = format === "psql"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect to your database</DialogTitle>
          <DialogDescription>
            Use these connection details in your application
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Database selector */}
          <Field>
            <FieldLabel className="gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Database
            </FieldLabel>
            <Select value={selectedDb} onValueChange={(val) => {
              setSelectedDb(val)
              userManuallySelected.current = false
            }}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Select database" />
              </SelectTrigger>
              <SelectContent>
                {databases.map((db) => (
                  <SelectItem key={db.name} value={db.name}>
                    {db.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Role selector */}
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel className="gap-1.5">
                <User className="w-3.5 h-3.5" />
                Role
              </FieldLabel>
              {selectedUser && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                  onClick={handleResetPassword}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Resetting...
                    </span>
                  ) : resetSuccess ? (
                    <span className="flex items-center gap-1 text-green-500">
                      <CheckCircle2 className="w-3 h-3" />
                      Password reset
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <KeyRound className="w-3 h-3" />
                      Reset password
                    </span>
                  )}
                </button>
              )}
            </div>
            <Select value={selectedUser} onValueChange={(val) => {
              setSelectedUser(val)
              userManuallySelected.current = true
              setTempPassword(null)
              setResetSuccess(false)
            }}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {filteredUsers.map((user) => (
                  <SelectItem key={user.username} value={user.username}>
                    {user.username}
                    {user.superuser && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        superuser
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Format + SSL row */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <Field className="flex-1">
            <FieldLabel>Connection string</FieldLabel>
            <Select
              value={format}
              onValueChange={(val) => setFormat(val as ConnectionFormat)}
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uri">PostgreSQL URI</SelectItem>
                <SelectItem value="parameters">Parameters</SelectItem>
                <SelectItem value="env">.env</SelectItem>
                <SelectItem value="psql">psql</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="flex items-center gap-2 pb-0.5">
            <Switch
              checked={sslEnabled}
              onCheckedChange={setSslEnabled}
              id="ssl-toggle"
            />
            <label
              htmlFor="ssl-toggle"
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              SSL
            </label>
          </div>
        </div>

        {/* Connection string display */}
        <div className="relative">
          <pre className="bg-muted rounded-lg p-4 font-mono text-sm break-all whitespace-pre-wrap text-foreground min-h-[60px] select-all">
            {connectionString || (
              <span className="text-muted-foreground">
                Select a database and role to see the connection string
              </span>
            )}
          </pre>
        </div>

        {/* psql note */}
        {psqlNote && connectionString && (
          <p className="text-xs text-muted-foreground -mt-2">
            psql will prompt for the password when you connect.
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            className="gap-2 flex-1"
            onClick={handleCopy}
            disabled={!connectionString}
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? "Copied!" : "Copy snippet"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowPassword(!showPassword)}
            disabled={!hasPassword}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {showPassword ? "Hide password" : "Show password"}
          </Button>
        </div>

        {!hasPassword && selectedUser && selectedUser !== "postgres" && (
          <p className="text-xs text-muted-foreground text-center -mt-1">
            Password unknown — use <strong>Reset password</strong> above to generate a new one
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
