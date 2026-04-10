import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"
import { NextRequest, NextResponse } from "next/server"

const DEV_BYPASS =
  process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true"

const handler = toNextJsHandler(auth)

export const POST = handler.POST

export async function GET(req: NextRequest) {
  // In dev bypass mode, return a fake session for the get-session endpoint
  if (DEV_BYPASS && req.nextUrl.pathname === "/api/auth/get-session") {
    return NextResponse.json({
      user: {
        id: "dev-user",
        name: "Dev User",
        email: "dev@localhost",
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        image: null,
        twoFactorEnabled: false,
      },
      session: {
        id: "dev-session",
        userId: "dev-user",
        token: "dev-token",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  }

  return handler.GET(req)
}
