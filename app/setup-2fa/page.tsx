"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { twoFactor, useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Database, ShieldCheck, Loader2 } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Setup2FAPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [totpURI, setTotpURI] = useState("")
  const [qrImage, setQrImage] = useState("")
  const [verifyCode, setVerifyCode] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isEnabling, setIsEnabling] = useState(true)

  useEffect(() => {
    if (!session) return

    const enable2FA = async () => {
      try {
        const result = await twoFactor.enable({
          password: "", // Already authenticated
        })

        if (result.data) {
          setTotpURI(result.data.totpURI)
          // Generate QR code as data URL
          const QRCode = await import("qrcode")
          const dataUrl = await QRCode.toDataURL(result.data.totpURI)
          setQrImage(dataUrl)
        }
      } catch {
        // 2FA may already be enabled, try to get fresh URI
      } finally {
        setIsEnabling(false)
      }
    }

    enable2FA()
  }, [session])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await twoFactor.verifyTotp({ code: verifyCode })

      if (result.error) {
        setError(result.error.message || "Invalid code")
        setIsLoading(false)
        return
      }

      router.push("/dashboard")
    } catch {
      setError("Verification failed. Please try again.")
      setIsLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 border border-primary/20">
            <Database className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Voltgres</h1>
            <p className="text-sm text-muted-foreground">
              PostgreSQL Manager
            </p>
          </div>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 rounded-full bg-primary/10">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">
              Set Up Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Two-factor authentication is required to secure your account.
              Scan the QR code with your authenticator app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isEnabling ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {qrImage && (
                  <div className="flex justify-center mb-6">
                    <div className="p-4 bg-white rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrImage}
                        alt="2FA QR Code"
                        width={200}
                        height={200}
                      />
                    </div>
                  </div>
                )}

                {totpURI && (
                  <div className="mb-6">
                    <p className="text-xs text-muted-foreground text-center mb-2">
                      Or enter this key manually:
                    </p>
                    <code className="block w-full p-3 rounded-lg bg-muted text-xs font-mono text-center text-foreground break-all">
                      {totpURI.match(/secret=([^&]+)/)?.[1] || totpURI}
                    </code>
                  </div>
                )}

                <form onSubmit={handleVerify}>
                  <Field>
                    <FieldLabel htmlFor="verify-code">
                      Verification Code
                    </FieldLabel>
                    <Input
                      id="verify-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      className="bg-input border-border text-center text-2xl tracking-widest font-mono"
                      autoFocus
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </Field>

                  {error && (
                    <p className="text-sm text-destructive mt-4">{error}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full mt-6"
                    disabled={isLoading || verifyCode.length !== 6}
                  >
                    {isLoading ? "Verifying..." : "Verify & Complete Setup"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
