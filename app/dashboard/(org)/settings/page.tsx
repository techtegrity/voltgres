"use client"

import { useState, useEffect } from "react"
import { useConnection } from "@/hooks/use-connection"
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
import { Settings, Server, Save, Loader2, CheckCircle2, XCircle, HardDrive, Shield, Plus, Trash2, Globe, Key, Network, AlertTriangle } from "lucide-react"
import { useAccessRules } from "@/hooks/use-access-rules"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SettingsPage() {
  const { config, serverInfo, loading, updateConnection, testConnection } = useConnection()

  const [host, setHost] = useState("")
  const [port, setPort] = useState("5432")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [sslMode, setSslMode] = useState("prefer")

  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    if (config) {
      setHost(config.host)
      setPort(config.port.toString())
      setUsername(config.username)
      setPassword(config.password)
      setSslMode(config.sslMode)
    }
  }, [config])

  const handleSave = async () => {
    await updateConnection({
      host,
      port: parseInt(port),
      username,
      password,
      sslMode,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection({
        host,
        port: parseInt(port),
        username,
        password,
      })
      setTestResult({
        success: result.success,
        message: result.success
          ? `Connected successfully (${result.version})`
          : result.error || "Connection failed",
      })
    } catch (err) {
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
      <div className="p-6 lg:p-8 max-w-4xl flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your PostgreSQL server connection and snapshot storage
        </p>
      </div>

      {/* Connection Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Connection Settings</CardTitle>
              <CardDescription>
                Configure how Voltgres connects to your PostgreSQL server
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="host">Host</FieldLabel>
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost"
                className="bg-input border-border max-w-md"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The hostname or IP address of your PostgreSQL server
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="port">Port</FieldLabel>
              <Input
                id="port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="5432"
                className="bg-input border-border max-w-md"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default PostgreSQL port is 5432
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="postgres"
                className="bg-input border-border max-w-md"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The database user to connect as
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="bg-input border-border max-w-md"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The password for the database user
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="sslMode">SSL Mode</FieldLabel>
              <Select value={sslMode} onValueChange={setSslMode}>
                <SelectTrigger className="bg-input border-border max-w-md w-full">
                  <SelectValue placeholder="Select SSL mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disable">Disable</SelectItem>
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="prefer">Prefer</SelectItem>
                  <SelectItem value="require">Require</SelectItem>
                  <SelectItem value="verify-ca">Verify CA</SelectItem>
                  <SelectItem value="verify-full">Verify Full</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                The SSL encryption mode for the connection
              </p>
            </Field>
          </FieldGroup>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              {saved ? "Saved!" : "Save Settings"}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
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

      {/* Server Info */}
      <Card className="bg-card border-border mt-6">
        <CardHeader>
          <CardTitle>Server Information</CardTitle>
          <CardDescription>
            Current PostgreSQL server details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">PostgreSQL Version</p>
              <p className="text-foreground font-medium">
                {serverInfo?.version ?? "Not connected"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Server Uptime</p>
              <p className="text-foreground font-medium">
                {serverInfo?.uptime ?? "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Max Connections</p>
              <p className="text-foreground font-medium">
                {serverInfo?.maxConnections ?? "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Active Connections</p>
              <p className="text-foreground font-medium">
                {serverInfo?.activeConnections ?? "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Snapshot Storage */}
      <StorageSettingsCard />

      {/* Access Control */}
      <AccessControlCard />
    </div>
  )
}

function StorageSettingsCard() {
  const { config, loading, save, testConnection, remove } = useStorageConfig()

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
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
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
    try {
      const result = await testConnection({
        provider,
        bucket,
        region,
        endpoint: provider === "r2" ? endpoint : undefined,
        accessKeyId,
        secretAccessKey,
      })
      setTestResult({
        success: result.success,
        message: result.success
          ? "Connected to bucket successfully"
          : result.error || "Connection failed",
      })
    } catch (err) {
      setTestResult({
        success: false,
        message: (err as Error).message || "Connection failed",
      })
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  if (loading) return null

  return (
    <Card className="bg-card border-border mt-6">
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

const RULE_TYPE_OPTIONS = [
  { value: "ip", label: "IP Address", icon: Globe, placeholder: "203.0.113.5" },
  { value: "cidr", label: "CIDR Range", icon: Network, placeholder: "10.0.0.0/8" },
  { value: "header_secret", label: "Header Secret", icon: Key, placeholder: "my-secret-token" },
] as const

function AccessControlCard() {
  const { rules, loading, addRule, deleteRule, toggleRule, getMyIp } = useAccessRules()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newType, setNewType] = useState<string>("ip")
  const [newValue, setNewValue] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectingIp, setDetectingIp] = useState(false)

  const hasEnabledRules = rules.some((r) => r.enabled)
  const typeOption = RULE_TYPE_OPTIONS.find((t) => t.value === newType) || RULE_TYPE_OPTIONS[0]

  const handleAdd = async () => {
    if (!newValue.trim()) return
    setAdding(true)
    setError(null)
    try {
      await addRule({ type: newType, value: newValue.trim(), description: newDescription.trim() })
      setNewValue("")
      setNewDescription("")
      setShowAddForm(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  const handleAddMyIp = async () => {
    setDetectingIp(true)
    try {
      const ip = await getMyIp()
      setNewType("ip")
      setNewValue(ip)
      setNewDescription("My current IP")
      setShowAddForm(true)
    } catch {
      setError("Could not detect your IP")
    } finally {
      setDetectingIp(false)
    }
  }

  if (loading) return null

  return (
    <Card className="bg-card border-border mt-6">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle>Access Control</CardTitle>
            <CardDescription>
              Restrict access to this Voltgres instance by IP address or secret token
            </CardDescription>
          </div>
          {hasEnabledRules && (
            <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-600/5">
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Info about how it works */}
        <div className="text-sm text-muted-foreground mb-4 space-y-1">
          <p>When rules exist, only matching IPs or requests with the correct header token can access this instance.</p>
          <p>If all rules are disabled or deleted, access control is turned off automatically.</p>
        </div>

        {/* Warning when active */}
        {hasEnabledRules && (
          <Alert className="mb-4 border-amber-600/30 bg-amber-600/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-600">
              Access control is active. Make sure your current IP or token is in the allowlist to avoid being locked out.
              {process.env.NEXT_PUBLIC_APP_URL && (
                <span className="block mt-1 text-xs text-amber-600/70">
                  Emergency bypass: set <code className="bg-amber-600/10 px-1 rounded">BYPASS_TOKEN</code> env var, then access with <code className="bg-amber-600/10 px-1 rounded">?bypass=your-token</code>
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Rules list */}
        {rules.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border mb-4">
            {rules.map((rule) => {
              const TypeIcon = RULE_TYPE_OPTIONS.find((t) => t.value === rule.type)?.icon || Globe
              return (
                <div key={rule.id} className="flex items-center gap-3 px-4 py-3">
                  <TypeIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono truncate">{rule.value}</code>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {rule.type === "header_secret" ? "token" : rule.type}
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{rule.description}</p>
                    )}
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {rules.length === 0 && !showAddForm && (
          <div className="text-center py-8 border border-dashed border-border rounded-lg mb-4">
            <Shield className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No access rules configured</p>
            <p className="text-xs text-muted-foreground mt-1">All traffic is currently allowed</p>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <div className="border border-border rounded-lg p-4 mb-4 space-y-3">
            <div className="flex gap-3">
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="bg-input border-border w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <opt.icon className="w-3.5 h-3.5" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={typeOption.placeholder}
                className="bg-input border-border flex-1 font-mono"
              />
            </div>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional, e.g. &quot;Office VPN&quot;)"
              className="bg-input border-border"
            />
            {newType === "header_secret" && (
              <p className="text-xs text-muted-foreground">
                Requests must include <code className="bg-muted px-1 rounded">X-Voltgres-Token: {newValue || "your-secret"}</code> header.
                Set this in your platform&apos;s environment or middleware configuration.
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={adding || !newValue.trim()} size="sm" className="gap-1.5">
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Rule
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowAddForm(false); setError(null) }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!showAddForm && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add Rule
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddMyIp}
                disabled={detectingIp}
                className="gap-1.5"
              >
                {detectingIp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                Add My Current IP
              </Button>
            </>
          )}
        </div>

        {/* Platform guidance */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Platform Setup Guide</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="font-medium text-foreground/70 shrink-0">VPS / DigitalOcean:</span>
              <span>Use IP or CIDR rules with your server&apos;s static IP</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-foreground/70 shrink-0">Vercel:</span>
              <span>Use Header Secret — add <code className="bg-muted px-0.5 rounded">X-Voltgres-Token</code> via middleware</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-foreground/70 shrink-0">Render:</span>
              <span>Use Header Secret or static outbound IPs (paid plans)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-foreground/70 shrink-0">Railway:</span>
              <span>Use Header Secret — no static outbound IPs</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
