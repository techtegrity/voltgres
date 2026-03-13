"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Loader2, Trash2, AlertTriangle } from "lucide-react"

interface DeleteDatabaseDialogProps {
  dbName: string
  owner: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteDatabaseDialog({
  dbName,
  owner,
  open,
  onOpenChange,
  onDeleted,
}: DeleteDatabaseDialogProps) {
  const [confirmDelete, setConfirmDelete] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Follow-up: delete owner role?
  const [showDeleteUser, setShowDeleteUser] = useState(false)
  const [deletingUser, setDeletingUser] = useState(false)
  const [exclusiveOwner, setExclusiveOwner] = useState<string | null>(null)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmDelete("")
      setDeleting(false)
      setError(null)
    }
  }, [open])

  const handleDelete = async () => {
    if (confirmDelete !== dbName) return
    setDeleting(true)
    setError(null)
    try {
      await api.databases.delete(dbName)

      // Check if owner is exclusive to this database
      if (owner) {
        try {
          const users = await api.users.list()
          const ownerUser = users.find((u) => u.username === owner)
          // After deletion, if the owner has no remaining database access, they were exclusive
          if (ownerUser && ownerUser.databases.length === 0) {
            setExclusiveOwner(owner)
            onOpenChange(false)
            setShowDeleteUser(true)
            return
          }
        } catch {
          // If we can't check, just skip the prompt
        }
      }

      onOpenChange(false)
      onDeleted()
    } catch (err) {
      setError((err as Error).message)
      setDeleting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!exclusiveOwner) return
    setDeletingUser(true)
    try {
      await api.users.delete(exclusiveOwner)
    } catch {
      // user deletion is best-effort
    }
    setShowDeleteUser(false)
    setDeletingUser(false)
    setExclusiveOwner(null)
    onDeleted()
  }

  const handleSkipDeleteUser = () => {
    setShowDeleteUser(false)
    setExclusiveOwner(null)
    onDeleted()
  }

  return (
    <>
      {/* Confirmation Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete Database
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              database and all its data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Type <span className="font-mono font-medium text-foreground">{dbName}</span> to confirm:
            </p>
            <Input
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={dbName}
              className="bg-input border-border font-mono"
              autoFocus
            />
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmDelete !== dbName || deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {deleting ? "Deleting..." : "Delete Database"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Owner Role Dialog */}
      <Dialog open={showDeleteUser} onOpenChange={(o) => {
        if (!o) handleSkipDeleteUser()
      }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete Owner Role?
            </DialogTitle>
            <DialogDescription>
              The role <span className="font-mono font-medium text-foreground">{exclusiveOwner}</span> was
              the owner of <span className="font-mono font-medium text-foreground">{dbName}</span> and
              has no access to any other databases. Would you like to delete this role as well?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleSkipDeleteUser} disabled={deletingUser}>
              No, Keep Role
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deletingUser}
            >
              {deletingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {deletingUser ? "Deleting..." : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
