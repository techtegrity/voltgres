"use client"

import { useConnection } from "@/hooks/use-connection"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function ServerInfoPage() {
  const { serverInfo, loading } = useConnection()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Server Information</CardTitle>
        <CardDescription>
          Current PostgreSQL server details
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">PostgreSQL Version</p>
            <p className="text-foreground font-medium">
              {serverInfo?.version ?? "Not connected"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Server Uptime</p>
            <p className="text-foreground font-medium">
              {serverInfo?.uptime ?? "N/A"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Max Connections</p>
            <p className="text-foreground font-medium">
              {serverInfo?.maxConnections ?? "N/A"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Active Connections</p>
            <p className="text-foreground font-medium">
              {serverInfo?.activeConnections ?? "N/A"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
