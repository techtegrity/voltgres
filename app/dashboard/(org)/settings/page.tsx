"use client"

import { useState, useEffect } from "react"
import { useConnection } from "@/hooks/use-connection"
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
import { Server, Save, Loader2, CheckCircle2, XCircle } from "lucide-react"

export default function ConnectionSettingsPage() {
  const { config, loading, updateConnection, testConnection } = useConnection()

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
  )
}
