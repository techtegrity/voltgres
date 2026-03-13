"use client"

import { useState, useEffect, use } from "react"
import { useTables } from "@/hooks/use-tables"
import { useDatabases } from "@/hooks/use-databases"
import { usePgUsers } from "@/hooks/use-pg-users"
import { useConnection } from "@/hooks/use-connection"
import { useKnownPasswords } from "@/hooks/use-known-passwords"
import { api, type DatabaseRow } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConnectionModal } from "@/components/connection-modal"
import {
  Database,
  Link,
  Table2,
  Users,
  Clock,
  HardDrive,
  Activity,
  Zap,
} from "lucide-react"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export default function DatabaseDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const { tables } = useTables(dbName)
  const { databases } = useDatabases()
  const { users, refresh: refreshUsers } = usePgUsers(dbName)
  const { config } = useConnection()
  const { passwords: knownPasswords, setPassword: setKnownPassword } = useKnownPasswords()
  const [connectionModalOpen, setConnectionModalOpen] = useState(false)
  const [dbInfo, setDbInfo] = useState<DatabaseRow | null>(null)

  useEffect(() => {
    api.databases.get(dbName).then(setDbInfo).catch(() => {})
  }, [dbName])

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-mono">{dbName}</h1>
            <p className="text-sm text-muted-foreground">
              Owner: {dbInfo?.owner ?? "..."} &bull; {dbInfo?.encoding ?? "..."}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <HardDrive className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatBytes(dbInfo?.size_bytes ?? 0)}</p>
                <p className="text-sm text-muted-foreground">Storage</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-chart-2/10">
                <Table2 className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{tables.length}</p>
                <p className="text-sm text-muted-foreground">Tables</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-chart-3/10">
                <Users className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{users.length}</p>
                <p className="text-sm text-muted-foreground">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-chart-4/10">
                <Activity className="w-5 h-5 text-chart-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">Active</p>
                <p className="text-sm text-muted-foreground">Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Connection
              </CardTitle>
              <CardDescription>
                Get connection details for your application
              </CardDescription>
            </div>
            <Button className="gap-2" onClick={() => setConnectionModalOpen(true)}>
              <Link className="w-4 h-4" />
              Connect
            </Button>
          </div>
        </CardHeader>
      </Card>

      <ConnectionModal
        open={connectionModalOpen}
        onOpenChange={setConnectionModalOpen}
        databases={databases}
        users={users}
        initialDatabase={dbName}
        adminUsername={config?.username}
        knownPasswords={knownPasswords}
        onUsersRefresh={refreshUsers}
        onPasswordReset={(username, password) =>
          setKnownPassword(username, password)
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Database Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Encoding</span>
                <span className="text-foreground font-medium">{dbInfo?.encoding ?? "..."}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Owner</span>
                <span className="text-foreground font-medium">{dbInfo?.owner ?? "..."}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Collation</span>
                <span className="text-foreground font-medium">{dbInfo?.collation ?? "..."}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
