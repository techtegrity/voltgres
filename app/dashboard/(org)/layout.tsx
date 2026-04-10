"use client"

import { OrgSidebar } from "@/components/org-sidebar"
import { MobileSidebarProvider } from "@/components/mobile-sidebar-wrapper"
import { MobileHeader } from "@/components/mobile-header"
import { ThemeToggle } from "@/components/theme-toggle"

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MobileSidebarProvider sidebar={<OrgSidebar />}>
      <MobileHeader>
        <ThemeToggle />
      </MobileHeader>
      {children}
    </MobileSidebarProvider>
  )
}
