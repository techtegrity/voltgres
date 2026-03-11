"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { useDatabases } from "@/hooks/use-databases"
import { api, type DatabaseRow } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Settings, Trash2, AlertTriangle } from "lucide-react"

export default function DatabaseSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const router = useRouter()
  const { deleteDatabase } = useDatabases()

  const [confirmDelete, setConfirmDelete] = useState("")
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [dbInfo, setDbInfo] = useState<DatabaseRow | null>(null)

  useEffect(() => {
    api.databases.get(dbName).then(setDbInfo).catch(() => {})
  }, [dbName])

  const handleDelete = async () => {
    if (confirmDelete === dbName) {
      await deleteDatabase(dbName)
      router.push("/dashboard")
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure settings for {dbName}
        </p>
      </div>

      {/* Database Info */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <CardTitle className="text-base">Database Information</CardTitle>
          <CardDescription>
            Basic details about this database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Database Name</FieldLabel>
              <Input
                value={dbName}
                disabled
                className="bg-muted border-border max-w-md font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Database names cannot be changed after creation
              </p>
            </Field>
            <Field>
              <FieldLabel>Owner</FieldLabel>
              <Input
                value={dbInfo?.owner ?? "..."}
                disabled
                className="bg-muted border-border max-w-md"
              />
            </Field>
            <Field>
              <FieldLabel>Encoding</FieldLabel>
              <Input
                value={dbInfo?.encoding ?? "..."}
                disabled
                className="bg-muted border-border max-w-md"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-card border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div>
              <p className="font-medium text-foreground">Delete this database</p>
              <p className="text-sm text-muted-foreground">
                Once deleted, all data will be permanently removed
              </p>
            </div>
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete Database
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-destructive">Delete Database</DialogTitle>
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
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={confirmDelete !== dbName}
                  >
                    Delete Database
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
