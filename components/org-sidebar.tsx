"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Database,
  Users,
  Activity,
  Settings,
  LogOut,
  ChevronDown,
  Bell,
} from "lucide-react"
import { useAlerts } from "@/hooks/use-alerts"
import { ThemeToggle } from "@/components/theme-toggle"

const navigation = [
  { name: "Databases", href: "/dashboard", icon: Database },
  { name: "Users", href: "/dashboard/users", icon: Users },
  { name: "Activity", href: "/dashboard/activity", icon: Activity },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function OrgSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { alerts } = useAlerts()

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  return (
    <div className="flex flex-col h-full w-56 bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded bg-primary text-primary-foreground">
            <Database className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sidebar-foreground">Voltgres</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {alerts.length > 0 && (
            <Link
              href="/dashboard"
              className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-sidebar-accent transition-colors"
            >
              <Bell className="w-4 h-4 text-yellow-500" />
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {alerts.length}
              </span>
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* Section Label */}
      <div className="px-4 pt-4 pb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Organization
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2">
        <ul className="space-y-0.5">
          {navigation.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href)
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            {session?.user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <span className="text-sm text-sidebar-foreground truncate">
            {session?.user?.name || session?.user?.email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-muted-foreground hover:text-destructive px-3"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
