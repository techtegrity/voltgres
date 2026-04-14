"use client"

import { useState, use } from "react"
import { useBackups } from "@/hooks/use-backups"
import { useSnapshots } from "@/hooks/use-snapshots"
import { useStorageConfig } from "@/hooks/use-storage-config"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ImportDatabaseDialog } from "@/components/import-database-dialog"
import {
  HardDrive,
  Plus,
  Calendar,
  Download,
  Trash2,
  RefreshCw,
  Cloud,
  History,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Settings,
  MoreVertical,
  Import,
  Bomb,
  Scissors,
} from "lucide-react"
import Link from "next/link"

export default function DatabaseDataPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const { backups, addBackup, updateBackup, deleteBackup } = useBackups(dbName)
  const { snapshots, loading: snapshotsLoading, createSnapshot, deleteSnapshot } = useSnapshots(dbName)
  const { config: storageConfig, loading: storageLoading } = useStorageConfig()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [newBackupName, setNewBackupName] = useState("")
  const [newBackupSchedule, setNewBackupSchedule] = useState("daily")
  const [creating, setCreating] = useState(false)
  const [restoreDialogId, setRestoreDialogId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [newPruningEnabled, setNewPruningEnabled] = useState(true)
  const [newRetentionKeepLast, setNewRetentionKeepLast] = useState(7)
  const [newRetentionThinKeepEvery, setNewRetentionThinKeepEvery] = useState(30)
  const [editingBackupId, setEditingBackupId] = useState<string | null>(null)
  const [editPruningEnabled, setEditPruningEnabled] = useState(true)
  const [editRetentionKeepLast, setEditRetentionKeepLast] = useState(7)
  const [editRetentionThinKeepEvery, setEditRetentionThinKeepEvery] = useState(30)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState("")
  const [resetting, setResetting] = useState(false)

  const storageConfigured = !storageLoading && storageConfig !== null

  const scheduleOptions: Record<string, string> = {
    hourly: "0 * * * *",
    daily: "0 2 * * *",
    weekly: "0 2 * * 0",
    monthly: "0 2 1 * *",
  }

  const retentionDefaults: Record<string, { keepLast: number; thinEvery: number }> = {
    hourly: { keepLast: 24, thinEvery: 1 },
    daily: { keepLast: 7, thinEvery: 30 },
    weekly: { keepLast: 4, thinEvery: 84 },
    monthly: { keepLast: 12, thinEvery: 365 },
  }

  const thinOptions: Record<string, { label: string; value: number }[]> = {
    hourly: [
      { label: "1 day", value: 1 },
      { label: "2 days", value: 2 },
      { label: "7 days", value: 7 },
    ],
    daily: [
      { label: "7 days", value: 7 },
      { label: "14 days", value: 14 },
      { label: "30 days", value: 30 },
      { label: "90 days", value: 90 },
    ],
    weekly: [
      { label: "4 weeks", value: 28 },
      { label: "8 weeks", value: 56 },
      { label: "12 weeks", value: 84 },
      { label: "26 weeks", value: 182 },
    ],
    monthly: [
      { label: "3 months", value: 90 },
      { label: "6 months", value: 182 },
      { label: "12 months", value: 365 },
    ],
  }

  const scheduleKeyFromCron = (cronExpr: string): string => {
    for (const [key, val] of Object.entries(scheduleOptions)) {
      if (val === cronExpr) return key
    }
    return "daily"
  }

  const handleFrequencyChange = (freq: string) => {
    setNewBackupSchedule(freq)
    const defaults = retentionDefaults[freq]
    setNewRetentionKeepLast(defaults.keepLast)
    setNewRetentionThinKeepEvery(defaults.thinEvery)
  }

  const formatThinEvery = (days: number): string => {
    if (days === 1) return "1 day"
    if (days < 7) return `${days} days`
    if (days % 7 === 0 && days < 28) return `${days / 7} week${days / 7 > 1 ? "s" : ""}`
    if (days < 60) return `${days} days`
    if (days < 365) return `~${Math.round(days / 30)} months`
    return `${Math.round(days / 365)} year${Math.round(days / 365) > 1 ? "s" : ""}`
  }

  const handleCreateSchedule = () => {
    if (newBackupName) {
      addBackup({
        name: newBackupName,
        type: "s3",
        schedule: scheduleOptions[newBackupSchedule],
        enabled: true,
        databases: [dbName],
        destination: "",
        pruningEnabled: newPruningEnabled,
        retentionKeepLast: newRetentionKeepLast,
        retentionThinKeepEvery: newRetentionThinKeepEvery,
      })
      setNewBackupName("")
      setNewPruningEnabled(true)
      setNewRetentionKeepLast(retentionDefaults.daily.keepLast)
      setNewRetentionThinKeepEvery(retentionDefaults.daily.thinEvery)
      setIsCreateOpen(false)
    }
  }

  const openEditRetention = (config: typeof backups[0]) => {
    setEditingBackupId(config.id)
    setEditPruningEnabled(config.pruningEnabled)
    setEditRetentionKeepLast(config.retentionKeepLast)
    setEditRetentionThinKeepEvery(config.retentionThinKeepEvery)
  }

  const handleSaveRetention = async () => {
    if (!editingBackupId) return
    await updateBackup(editingBackupId, {
      pruningEnabled: editPruningEnabled,
      retentionKeepLast: editRetentionKeepLast,
      retentionThinKeepEvery: editRetentionThinKeepEvery,
    })
    setEditingBackupId(null)
  }

  const handleCreateSnapshot = async () => {
    setCreating(true)
    try {
      await createSnapshot(dbName)
    } finally {
      setCreating(false)
    }
  }

  const handleRunNow = async () => {
    setCreating(true)
    try {
      await createSnapshot(dbName)
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (snapshotId: string) => {
    setRestoring(true)
    try {
      await api.snapshots.restore(snapshotId)
      setRestoreDialogId(null)
    } finally {
      setRestoring(false)
    }
  }

  const handleDelete = async (snapshotId: string) => {
    await deleteSnapshot(snapshotId)
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await api.databases.reset(dbName)
      setResetDialogOpen(false)
      setResetConfirmText("")
    } finally {
      setResetting(false)
    }
  }

  const formatSchedule = (cron: string) => {
    if (cron === "0 * * * *") return "Hourly"
    if (cron === "0 2 * * *") return "Daily at 2:00 AM"
    if (cron === "0 2 * * 0") return "Weekly on Sunday"
    if (cron === "0 2 1 * *") return "Monthly on 1st"
    return cron
  }

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "—"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data</h1>
          <p className="text-muted-foreground mt-1">
            Manage backups, imports, and data for {dbName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle>Create Backup Schedule</DialogTitle>
              <DialogDescription>
                Set up automatic backups for {dbName}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="backup-name">Schedule Name</FieldLabel>
                <Input
                  id="backup-name"
                  value={newBackupName}
                  onChange={(e) => setNewBackupName(e.target.value)}
                  placeholder="Daily Production Backup"
                  className="bg-input border-border"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="backup-schedule">Frequency</FieldLabel>
                <Select value={newBackupSchedule} onValueChange={handleFrequencyChange}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily (2:00 AM)</SelectItem>
                    <SelectItem value="weekly">Weekly (Sunday)</SelectItem>
                    <SelectItem value="monthly">Monthly (1st)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            {/* Retention / Pruning */}
            <div className="border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Auto-prune old backups</span>
                </div>
                <Switch
                  checked={newPruningEnabled}
                  onCheckedChange={setNewPruningEnabled}
                />
              </div>
              {newPruningEnabled && (
                <div className="space-y-3 pl-6">
                  <Field>
                    <FieldLabel htmlFor="keep-last">Keep last</FieldLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        id="keep-last"
                        type="number"
                        min={1}
                        max={999}
                        value={newRetentionKeepLast}
                        onChange={(e) => setNewRetentionKeepLast(parseInt(e.target.value) || 1)}
                        className="bg-input border-border w-20"
                      />
                      <span className="text-sm text-muted-foreground">backups</span>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="thin-every">Then keep 1 every</FieldLabel>
                    <Select
                      value={String(newRetentionThinKeepEvery)}
                      onValueChange={(v) => setNewRetentionThinKeepEvery(parseInt(v))}
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(thinOptions[newBackupSchedule] || thinOptions.daily).map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    Keeps {newRetentionKeepLast} most recent backups, then 1 per {formatThinEvery(newRetentionThinKeepEvery)}. Older excess backups are deleted automatically.
                  </p>
                </div>
              )}
            </div>
            {!storageConfigured && (
              <p className="text-sm text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Storage must be configured in Settings before snapshots can run.
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateSchedule} disabled={!newBackupName}>
                Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsImportOpen(true)} className="gap-2">
                <Import className="w-4 h-4" />
                Import Database
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ImportDatabaseDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        targetDatabase={dbName}
      />

      {/* Storage not configured warning */}
      {!storageLoading && !storageConfigured && (
        <Card className="bg-amber-500/5 border-amber-500/20 mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Snapshot storage not configured
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure S3 or Cloudflare R2 storage in Settings to create and manage snapshots.
                </p>
              </div>
              <Link href="/dashboard/settings">
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backup Schedules */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-2/10">
                <Calendar className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <CardTitle className="text-base">Backup Schedules</CardTitle>
                <CardDescription>
                  Automated backup jobs for this database
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {backups.length > 0 ? (
            <div className="space-y-4">
              {backups.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-background">
                      <Cloud className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{config.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSchedule(config.schedule)}
                        {config.lastRun && (
                          <> &bull; Last run: {new Date(config.lastRun).toLocaleDateString()}</>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {config.pruningEnabled ? (
                          <span className="flex items-center gap-1">
                            <Scissors className="w-3 h-3" />
                            Keep {config.retentionKeepLast}, then 1/{formatThinEvery(config.retentionThinKeepEvery)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">Pruning off</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(checked) => updateBackup(config.id, { enabled: checked })}
                      />
                      <span className="text-sm text-muted-foreground">
                        {config.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={creating || !storageConfigured}
                      onClick={handleRunNow}
                    >
                      <RefreshCw className="w-3 h-3" />
                      Run now
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => openEditRetention(config)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteBackup(config.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No backup schedules configured</p>
              <p className="text-sm mt-1">Create a schedule to automatically backup this database</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Retention Dialog */}
      <Dialog
        open={editingBackupId !== null}
        onOpenChange={(open) => { if (!open) setEditingBackupId(null) }}
      >
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Retention Policy</DialogTitle>
            <DialogDescription>
              Configure how old backups are pruned for this schedule
            </DialogDescription>
          </DialogHeader>
          <div className="border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Auto-prune old backups</span>
              </div>
              <Switch
                checked={editPruningEnabled}
                onCheckedChange={setEditPruningEnabled}
              />
            </div>
            {editPruningEnabled && (
              <div className="space-y-3 pl-6">
                <Field>
                  <FieldLabel>Keep last</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      value={editRetentionKeepLast}
                      onChange={(e) => setEditRetentionKeepLast(parseInt(e.target.value) || 1)}
                      className="bg-input border-border w-20"
                    />
                    <span className="text-sm text-muted-foreground">backups</span>
                  </div>
                </Field>
                <Field>
                  <FieldLabel>Then keep 1 every</FieldLabel>
                  <Select
                    value={String(editRetentionThinKeepEvery)}
                    onValueChange={(v) => setEditRetentionThinKeepEvery(parseInt(v))}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const editingConfig = backups.find((b) => b.id === editingBackupId)
                        const freq = editingConfig ? scheduleKeyFromCron(editingConfig.schedule) : "daily"
                        return (thinOptions[freq] || thinOptions.daily).map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))
                      })()}
                    </SelectContent>
                  </Select>
                </Field>
                <p className="text-xs text-muted-foreground">
                  Keeps {editRetentionKeepLast} most recent backups, then 1 per {formatThinEvery(editRetentionThinKeepEvery)}. Older excess backups are deleted automatically.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveRetention}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snapshots */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-3/10">
                <History className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <CardTitle className="text-base">Snapshots</CardTitle>
                <CardDescription>
                  Manual and scheduled backup snapshots
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              disabled={creating || !storageConfigured}
              onClick={handleCreateSnapshot}
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <HardDrive className="w-4 h-4" />
              )}
              Create snapshot
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {snapshotsLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : snapshots.length > 0 ? (
            <div className="space-y-3">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-4">
                    <SnapshotStatusDot status={snap.status} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm text-foreground">
                          {snap.database}
                        </p>
                        <Badge
                          variant={snap.trigger === "scheduled" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {snap.trigger}
                        </Badge>
                        <SnapshotStatusBadge status={snap.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(snap.createdAt)}
                        {snap.sizeBytes != null && <> &bull; {formatBytes(snap.sizeBytes)}</>}
                        {snap.error && (
                          <span className="text-destructive"> &bull; {snap.error}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {snap.status === "completed" && (
                      <>
                        <a
                          href={api.snapshots.downloadUrl(snap.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="w-3 h-3" />
                            Download
                          </Button>
                        </a>
                        <Dialog
                          open={restoreDialogId === snap.id}
                          onOpenChange={(open) => setRestoreDialogId(open ? snap.id : null)}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                              <RotateCcw className="w-3 h-3" />
                              Restore
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-card border-border max-w-md">
                            <DialogHeader>
                              <DialogTitle>Restore Snapshot</DialogTitle>
                              <DialogDescription>
                                This will restore the snapshot to database &quot;{snap.database}&quot;.
                                Existing data will be overwritten.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <Button
                                variant="destructive"
                                disabled={restoring}
                                onClick={() => handleRestore(snap.id)}
                                className="gap-2"
                              >
                                {restoring && <Loader2 className="w-4 h-4 animate-spin" />}
                                Restore
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                    {(snap.status === "completed" || snap.status === "failed") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(snap.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No snapshots yet</p>
              <p className="text-sm mt-1">
                {storageConfigured
                  ? "Create a snapshot to back up this database"
                  : "Configure storage in Settings to get started"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Database */}
      <Card className="bg-card border-destructive/30 mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Bomb className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-base">Reset Database</CardTitle>
                <CardDescription>
                  Drop all schemas and recreate a clean public schema
                </CardDescription>
              </div>
            </div>
            <Dialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) setResetConfirmText("") }}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Bomb className="w-4 h-4" />
                  Reset Database
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                  <DialogTitle>Reset Database</DialogTitle>
                  <DialogDescription>
                    This will permanently drop all schemas (including drizzle, public, and any others) and recreate an empty public schema. All tables, data, functions, and types will be destroyed.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Type <span className="font-mono font-bold text-destructive">{dbName}</span> to confirm:
                  </p>
                  <Input
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder={dbName}
                    className="bg-input border-border font-mono"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    disabled={resetConfirmText !== dbName || resetting}
                    onClick={handleReset}
                    className="gap-2"
                  >
                    {resetting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Reset Database
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}

function SnapshotStatusDot({ status }: { status: string }) {
  if (status === "pending" || status === "running") {
    return <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
  }
  if (status === "completed") {
    return <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
  }
  if (status === "failed") {
    return <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
  }
  return <div className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
}

function SnapshotStatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return <Badge variant="secondary" className="text-xs">Pending</Badge>
  }
  if (status === "running") {
    return <Badge variant="secondary" className="text-xs">Running</Badge>
  }
  if (status === "failed") {
    return <Badge variant="destructive" className="text-xs">Failed</Badge>
  }
  return null
}
