"use client"

import { Database, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMobileSidebar } from "@/components/mobile-sidebar-wrapper"

export function MobileHeader({ children }: { children?: React.ReactNode }) {
  const { setOpen } = useMobileSidebar()

  return (
    <div className="flex md:hidden items-center justify-between px-4 py-2 border-b border-border bg-sidebar shrink-0">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-primary text-primary-foreground">
            <Database className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-sm text-sidebar-foreground">Voltgres</span>
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-1">
          {children}
        </div>
      )}
    </div>
  )
}
