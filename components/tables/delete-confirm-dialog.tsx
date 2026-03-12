"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Trash2 } from "lucide-react"

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  onConfirm: () => Promise<void>
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Delete {count} {count === 1 ? "row" : "rows"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The selected {count === 1 ? "row" : "rows"} will be permanently deleted from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
