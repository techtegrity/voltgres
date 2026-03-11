"use client"

import { OrgSidebar } from "@/components/org-sidebar"

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background">
      <OrgSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
