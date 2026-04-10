"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Server, Info, HardDrive, Shield, DatabaseZap } from "lucide-react"

const tabs = [
  { label: "Connection", href: "/dashboard/settings", icon: Server },
  { label: "Server Info", href: "/dashboard/settings/server", icon: Info },
  { label: "Storage", href: "/dashboard/settings/storage", icon: HardDrive },
  { label: "Access Control", href: "/dashboard/settings/access", icon: Shield },
  { label: "App Data", href: "/dashboard/settings/app-data", icon: DatabaseZap },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your PostgreSQL server connection and Voltgres instance
        </p>
      </div>

      <nav className="bg-muted inline-flex h-9 w-fit max-w-full items-center justify-start rounded-lg p-[3px] mb-6 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/dashboard/settings"
              ? pathname === "/dashboard/settings"
              : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow]",
                "text-foreground dark:text-muted-foreground",
                isActive &&
                  "bg-background dark:bg-input/30 dark:text-foreground dark:border-input shadow-sm",
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
