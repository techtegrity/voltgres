"use client"

import { useState, use } from "react"
import { useBackups } from "@/hooks/use-backups"
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
  HardDrive,
  Plus,
  Clock,
  Calendar,
  Download,
  Trash2,
  RefreshCw,
  Zap,
  Cloud,
  History,
} from "lucide-react"

interface Snapshot {
  id: string
  name: string
  createdAt: Date
  size: string
  expiresAt: Date
}

export default function DatabaseBackupsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const { backups, addBackup, updateBackup, deleteBackup } = useBackups(dbName)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newBackupName, setNewBackupName] = useState("")
  const [newBackupType, setNewBackupType] = useState<"s3" | "gcs" | "local">("s3")
  const [newBackupSchedule, setNewBackupSchedule] = useState("daily")
  const [newBackupDestination, setNewBackupDestination] = useState("")

  // Mock snapshots (visual placeholders for now)
  const [snapshots] = useState<Snapshot[]>([
    {
      id: "1",
      name: `snapshot_${new Date().toISOString().split("T")[0]}T00:00:09Z`,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      size: "45.2 MB",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      id: "2",
      name: `snapshot_${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}T00:00:11Z`,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      size: "42.8 MB",
      expiresAt: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
    },
  ])

  const scheduleOptions: Record<string, string> = {
    hourly: "0 * * * *",
    daily: "0 2 * * *",
    weekly: "0 2 * * 0",
    monthly: "0 2 1 * *",
  }

  const handleCreate = () => {
    if (newBackupName && newBackupDestination) {
      addBackup({
        name: newBackupName,
        type: newBackupType,
        schedule: scheduleOptions[newBackupSchedule],
        enabled: true,
        databases: [dbName],
        destination: newBackupDestination,
      })
      setNewBackupName("")
      setNewBackupDestination("")
      setIsCreateOpen(false)
    }
  }

  const formatSchedule = (cron: string) => {
    if (cron === "0 * * * *") return "Hourly"
    if (cron === "0 2 * * *") return "Daily at 2:00 AM"
    if (cron === "0 2 * * 0") return "Weekly on Sunday"
    if (cron === "0 2 1 * *") return "Monthly on 1st"
    return cron
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Backup & Restore</h1>
          <p className="text-muted-foreground mt-1">
            Manage backups for {dbName}
          </p>
        </div>
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
                <FieldLabel htmlFor="backup-type">Destination Type</FieldLabel>
                <Select value={newBackupType} onValueChange={(v) => setNewBackupType(v as typeof newBackupType)}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="s3">Amazon S3</SelectItem>
                    <SelectItem value="gcs">Google Cloud Storage</SelectItem>
                    <SelectItem value="local">Local Storage</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="backup-schedule">Frequency</FieldLabel>
                <Select value={newBackupSchedule} onValueChange={setNewBackupSchedule}>
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
              <Field>
                <FieldLabel htmlFor="backup-destination">Destination Path</FieldLabel>
                <Input
                  id="backup-destination"
                  value={newBackupDestination}
                  onChange={(e) => setNewBackupDestination(e.target.value)}
                  placeholder={newBackupType === "s3" ? "s3://bucket/path" : newBackupType === "gcs" ? "gs://bucket/path" : "/var/backups"}
                  className="bg-input border-border font-mono text-sm"
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={!newBackupName || !newBackupDestination}>
                Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Point-in-time Restore */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Instant point-in-time restore</CardTitle>
              <CardDescription>
                Instantly restore this database to any point in the past 6 hours
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <Field className="flex-1 min-w-[200px]">
              <FieldLabel>Point in time</FieldLabel>
              <Input
                type="datetime-local"
                className="bg-input border-border"
                defaultValue={new Date().toISOString().slice(0, 16)}
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="outline">Preview data</Button>
              <Button>Restore to point in time</Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                        {formatSchedule(config.schedule)} &bull; {config.type.toUpperCase()}
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
                    <Button variant="outline" size="sm" className="gap-2">
                      <RefreshCw className="w-3 h-3" />
                      Run now
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
            <Button variant="outline" className="gap-2">
              <HardDrive className="w-4 h-4" />
              Create snapshot
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <div>
                    <p className="font-mono text-sm text-foreground">{snapshot.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {snapshot.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })} &bull; {snapshot.size} &bull; Expires {snapshot.expiresAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-3 h-3" />
                    Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
