"use client"

import { useState, createContext, useContext } from "react"
import { usePathname } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"

type MobileSidebarContextType = {
  open: boolean
  setOpen: (open: boolean) => void
}

const MobileSidebarContext = createContext<MobileSidebarContextType>({
  open: false,
  setOpen: () => {},
})

export function useMobileSidebar() {
  return useContext(MobileSidebarContext)
}

export function MobileSidebarProvider({
  children,
  sidebar,
}: {
  children: React.ReactNode
  sidebar: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const pathname = usePathname()

  // Close sheet on navigation
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (open) setOpen(false)
  }

  return (
    <MobileSidebarContext.Provider value={{ open, setOpen }}>
      <div className="flex h-screen bg-background">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          {sidebar}
        </div>

        {/* Mobile sheet */}
        {isMobile && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="left" className="w-56 p-0 gap-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto flex flex-col">
          {children}
        </main>
      </div>
    </MobileSidebarContext.Provider>
  )
}
