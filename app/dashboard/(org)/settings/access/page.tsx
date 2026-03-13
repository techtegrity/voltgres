"use client"

import { useState } from "react"
import { useAccessRules } from "@/hooks/use-access-rules"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Shield, Plus, Trash2, Globe, Key, Network, AlertTriangle, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

const RULE_TYPE_OPTIONS = [
  { value: "ip", label: "IP Address", icon: Globe, placeholder: "203.0.113.5" },
  { value: "cidr", label: "CIDR Range", icon: Network, placeholder: "10.0.0.0/8" },
  { value: "header_secret", label: "Header Secret", icon: Key, placeholder: "my-secret-token" },
] as const

export default function AccessControlPage() {
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
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle>App Access Control</CardTitle>
            <CardDescription>
              Restrict who can access this dashboard and API by IP address or secret token. Database-level access is managed per-database.
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
          <p>These rules control who can access the Voltgres dashboard and API. They do not affect direct PostgreSQL connections.</p>
          <p>When rules exist, only matching IPs or requests with the correct header token are allowed. If all rules are disabled or deleted, access control is turned off automatically.</p>
        </div>

        {/* Warning when active */}
        {hasEnabledRules && (
          <Alert className="mb-4 border-amber-600/30 bg-amber-600/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-600">
              App access control is active. Make sure your current IP or token is in the allowlist to avoid being locked out of the dashboard.
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
            <p className="text-sm text-muted-foreground">No app access rules configured</p>
            <p className="text-xs text-muted-foreground mt-1">All traffic to the dashboard and API is currently allowed</p>
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
