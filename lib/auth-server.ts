import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const DEV_BYPASS =
  process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true"

const DEV_SESSION = {
  user: {
    id: "dev-user",
    name: "Dev User",
    email: "dev@localhost",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    image: null,
    twoFactorEnabled: false,
  },
  session: {
    id: "dev-session",
    userId: "dev-user",
    token: "dev-token",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: "127.0.0.1",
    userAgent: "dev-bypass",
  },
}

export async function getServerSession() {
  if (DEV_BYPASS) return DEV_SESSION

  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session
}
