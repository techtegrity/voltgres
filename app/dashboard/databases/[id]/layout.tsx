"use client"

import { use } from "react"
import { DatabaseSidebar } from "@/components/database-sidebar"
import { MobileSidebarProvider } from "@/components/mobile-sidebar-wrapper"
import { MobileHeader } from "@/components/mobile-header"
import { ThemeToggle } from "@/components/theme-toggle"

export default function DatabaseLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)

  return (
    <MobileSidebarProvider
      sidebar={<DatabaseSidebar databaseId={id} databaseName={dbName} />}
    >
      <MobileHeader>
        <ThemeToggle />
      </MobileHeader>
      {children}
    </MobileSidebarProvider>
  )
}
