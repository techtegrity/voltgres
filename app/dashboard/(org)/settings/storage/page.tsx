"use client"

import { useState, useEffect } from "react"
import { useStorageConfig } from "@/hooks/use-storage-config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HardDrive, Save, Loader2, CheckCircle2, XCircle } from "lucide-react"

export default function StorageSettingsPage() {
  const { config, loading, save, testConnection } = useStorageConfig()

  const [provider, setProvider] = useState<string>("s3")
  const [bucket, setBucket] = useState("")
  const [region, setRegion] = useState("us-east-1")
  const [endpoint, setEndpoint] = useState("")
  const [accessKeyId, setAccessKeyId] = useState("")
  const [secretAccessKey, setSecretAccessKey] = useState("")
  const [pathPrefix, setPathPrefix] = useState("")

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    if (config) {
      setProvider(config.provider)
      setBucket(config.bucket)
      setRegion(config.region)
      setEndpoint(config.endpoint || "")
      setAccessKeyId(config.accessKeyId)
      setSecretAccessKey(config.secretAccessKey)
      setPathPrefix(config.pathPrefix || "")
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      provider,
      bucket,
      region,
      endpoint: provider === "r2" ? endpoint : undefined,
      accessKeyId,
      secretAccessKey: secretAccessKey ? `[${secretAccessKey.length} chars]` : "[empty]",
      pathPrefix,
    }
    console.log("[StorageSave] Saving with payload:", payload)
    try {
      await save({
        provider,
        bucket,
        region,
        endpoint: provider === "r2" ? endpoint : undefined,
        accessKeyId,
        secretAccessKey,
        pathPrefix,
      })
      console.log("[StorageSave] Save + refresh completed successfully")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error("[StorageSave] Error:", err)
      setTestResult({
        success: false,
        message: (err as Error).message || "Failed to save",
      })
      setTimeout(() => setTestResult(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const payload = {
      provider,
      bucket,
      region,
      endpoint: provider === "r2" ? endpoint : undefined,
      accessKeyId,
      secretAccessKey: secretAccessKey ? `[${secretAccessKey.length} chars]` : "[empty]",
    }
    console.log("[StorageTest] Request payload:", payload)
    try {
      const result = await testConnection({
        provider,
        bucket,
        region,
        endpoint: provider === "r2" ? endpoint : undefined,
        accessKeyId,
        secretAccessKey,
      })
      console.log("[StorageTest] Response:", result)
      setTestResult({
        success: result.success,
        message: result.success
          ? "Connected to bucket successfully"
          : result.error || "Connection failed",
      })
    } catch (err) {
      console.error("[StorageTest] Error:", err)
      setTestResult({
        success: false,
        message: (err as Error).message || "Connection failed",
      })
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <HardDrive className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>Snapshot Storage</CardTitle>
            <CardDescription>
              Configure S3 or Cloudflare R2 storage for database snapshots
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="storage-provider">Provider</FieldLabel>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="bg-input border-border max-w-md w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s3">Amazon S3</SelectItem>
                <SelectItem value="r2">Cloudflare R2</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="storage-bucket">Bucket</FieldLabel>
            <Input
              id="storage-bucket"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              placeholder="my-backups-bucket"
              className="bg-input border-border max-w-md"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="storage-region">Region</FieldLabel>
            <Input
              id="storage-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="us-east-1"
              className="bg-input border-border max-w-md"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {provider === "r2" ? "Use \"auto\" for Cloudflare R2" : "AWS region for the S3 bucket"}
            </p>
          </Field>
          {provider === "r2" && (
            <Field>
              <FieldLabel htmlFor="storage-endpoint">Endpoint</FieldLabel>
              <Input
                id="storage-endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://<account-id>.r2.cloudflarestorage.com"
                className="bg-input border-border max-w-md"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your Cloudflare R2 S3-compatible endpoint URL
              </p>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="storage-access-key">Access Key ID</FieldLabel>
            <Input
              id="storage-access-key"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              className="bg-input border-border max-w-md"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="storage-secret-key">Secret Access Key</FieldLabel>
            <Input
              id="storage-secret-key"
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              placeholder="Enter secret access key"
              className="bg-input border-border max-w-md"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="storage-prefix">Path Prefix (optional)</FieldLabel>
            <Input
              id="storage-prefix"
              value={pathPrefix}
              onChange={(e) => setPathPrefix(e.target.value)}
              placeholder="voltgres/backups"
              className="bg-input border-border max-w-md"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optional folder path inside the bucket
            </p>
          </Field>
        </FieldGroup>
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? "Saved!" : "Save Storage"}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing}
            className="gap-2"
          >
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            Test Connection
          </Button>
          {testResult && (
            <span className={`flex items-center gap-1.5 text-sm ${testResult.success ? "text-green-600" : "text-destructive"}`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {testResult.message}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
