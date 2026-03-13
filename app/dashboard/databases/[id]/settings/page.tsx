"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { api, type DatabaseRow } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { DeleteDatabaseDialog } from "@/components/delete-database-dialog"
import { Trash2, AlertTriangle, Shield, Loader2, CheckCircle2 } from "lucide-react"

export default function DatabaseSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const router = useRouter()

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [dbInfo, setDbInfo] = useState<DatabaseRow | null>(null)
  const [fixingOwnership, setFixingOwnership] = useState(false)
  const [ownershipFixed, setOwnershipFixed] = useState(false)
  const [ownershipError, setOwnershipError] = useState<string | null>(null)
  const [misconfiguredCount, setMisconfiguredCount] = useState(0)

  useEffect(() => {
    api.databases.get(dbName).then(setDbInfo).catch(() => {})
    api.databases.checkOwnership(dbName).then((r) => setMisconfiguredCount(r.misconfiguredCount)).catch(() => {})
  }, [dbName])

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

      {/* Fix Ownership — only shown when tables are owned by postgres */}
      {(misconfiguredCount > 0 && !ownershipFixed) && (
        <Card className="bg-card border-amber-500/50 mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-4 h-4" />
              Table Ownership Issue
            </CardTitle>
            <CardDescription>
              {misconfiguredCount} {misconfiguredCount === 1 ? "table is" : "tables are"} owned
              by the postgres superuser instead of the database owner. This can cause
              &quot;must be owner of table&quot; errors when apps run migrations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <div>
                <p className="font-medium text-foreground">Fix table ownership</p>
                <p className="text-sm text-muted-foreground">
                  Transfers all tables &amp; sequences to granted users so they can run migrations
                </p>
              </div>
              <Button
                variant="outline"
                className="gap-2"
                disabled={fixingOwnership}
                onClick={async () => {
                  setFixingOwnership(true)
                  setOwnershipFixed(false)
                  setOwnershipError(null)
                  try {
                    await api.databases.fixOwnership(dbName)
                    setOwnershipFixed(true)
                    setMisconfiguredCount(0)
                  } catch (err) {
                    setOwnershipError((err as Error).message)
                  } finally {
                    setFixingOwnership(false)
                  }
                }}
              >
                {fixingOwnership ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {fixingOwnership ? "Fixing..." : "Fix Ownership"}
              </Button>
            </div>
            {ownershipError && (
              <p className="mt-2 text-sm text-destructive">{ownershipError}</p>
            )}
          </CardContent>
        </Card>
      )}

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
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete Database
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteDatabaseDialog
        dbName={dbName}
        owner={dbInfo?.owner ?? null}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onDeleted={() => router.push("/dashboard")}
      />
    </div>
  )
}
