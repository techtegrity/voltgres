"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Database, Lock, Mail } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [needs2FA, setNeeds2FA] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn.email({ email, password })

      if (result.error) {
        if (result.error.message?.includes("two factor")) {
          setNeeds2FA(true)
        } else {
          setError(result.error.message || "Invalid credentials")
        }
        setIsLoading(false)
        return
      }

      router.push("/dashboard")
    } catch {
      setError("An error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const { signIn: twoFactorSignIn } = await import("@/lib/auth-client")
      const result = await twoFactorSignIn.email({ email, password })

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

  const handleGoogleSignIn = async () => {
    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      })
    } catch {
      setError("Google sign-in failed. Check that Google OAuth is configured.")
    }
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
            <CardTitle className="text-xl">
              {needs2FA ? "Two-Factor Authentication" : "Sign In"}
            </CardTitle>
            <CardDescription>
              {needs2FA
                ? "Enter the code from your authenticator app"
                : "Enter your credentials to access the dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {needs2FA ? (
              <form onSubmit={handleVerify2FA}>
                <Field>
                  <FieldLabel htmlFor="totp">Verification Code</FieldLabel>
                  <Input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="bg-input border-border text-center text-2xl tracking-widest font-mono"
                    autoFocus
                    required
                  />
                </Field>

                {error && (
                  <p className="text-sm text-destructive mt-4">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full mt-6"
                  disabled={isLoading || totpCode.length !== 6}
                >
                  {isLoading ? "Verifying..." : "Verify"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => {
                    setNeeds2FA(false)
                    setTotpCode("")
                    setError("")
                  }}
                >
                  Back to sign in
                </Button>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 bg-input border-border"
                          required
                        />
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 bg-input border-border"
                          required
                        />
                      </div>
                    </Field>
                  </FieldGroup>

                  {error && (
                    <p className="text-sm text-destructive mt-4">{error}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full mt-6"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>

                {process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          or continue with
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 text-foreground hover:text-foreground"
                      onClick={handleGoogleSignIn}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Sign in with Google
                    </Button>
                  </>
                )}

              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
