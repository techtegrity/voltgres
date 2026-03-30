"use client"

import { useAlerts } from "@/hooks/use-alerts"
import { AlertTriangle, X, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AlertsBanner() {
  const { alerts, resolve } = useAlerts()

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {alerts.map((alert) => {
        const isCritical = alert.type.includes("critical")
        return (
          <div
            key={alert.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg border text-sm",
              isCritical
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
            )}
          >
            {isCritical ? (
              <ShieldAlert className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{alert.message}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-transparent"
              onClick={() => resolve(alert.id)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
