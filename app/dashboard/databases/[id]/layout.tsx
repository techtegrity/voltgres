"use client"

import { use } from "react"
import { DatabaseSidebar } from "@/components/database-sidebar"

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
    <div className="flex h-screen bg-background">
      <DatabaseSidebar databaseId={id} databaseName={dbName} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
