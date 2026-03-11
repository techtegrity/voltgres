"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Database,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronDown,
  Terminal,
  Table2,
  HardDrive,
  Users,
  ArrowLeft,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

interface DatabaseSidebarProps {
  databaseId: string
  databaseName: string
}

export function DatabaseSidebar({ databaseId, databaseName }: DatabaseSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const basePath = `/dashboard/databases/${databaseId}`

  const projectNav = [
    { name: "Dashboard", href: basePath, icon: LayoutDashboard },
    { name: "Settings", href: `${basePath}/settings`, icon: Settings },
  ]

  const databaseNav = [
    { name: "SQL Editor", href: `${basePath}/sql`, icon: Terminal },
    { name: "Tables", href: `${basePath}/tables`, icon: Table2 },
    { name: "Backup & Restore", href: `${basePath}/backups`, icon: HardDrive },
    { name: "Users", href: `${basePath}/users`, icon: Users },
  ]

  const isActive = (href: string) => {
    if (href === basePath) {
      return pathname === basePath
    }
    return pathname.startsWith(href)
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
        <ThemeToggle />
      </div>

      {/* Back to Databases */}
      <div className="px-2 py-2 border-b border-sidebar-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Databases
        </Link>
      </div>

      {/* Database Name */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 border border-primary/20">
            <Database className="w-3 h-3 text-primary" />
          </div>
          <span className="font-medium text-sidebar-foreground font-mono text-sm truncate">
            {databaseName}
          </span>
        </div>
      </div>

      {/* Project Navigation */}
      <div className="px-4 pt-4 pb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Project
        </span>
      </div>
      <nav className="px-2">
        <ul className="space-y-0.5">
          {projectNav.map((item) => (
            <li key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Database Navigation */}
      <div className="px-4 pt-4 pb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Database
        </span>
      </div>
      <nav className="flex-1 px-2">
        <ul className="space-y-0.5">
          {databaseNav.map((item) => (
            <li key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            </li>
          ))}
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
