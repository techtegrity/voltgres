import { NextRequest, NextResponse } from "next/server"

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Block public registration when disabled
  if (pathname === "/signup") {
    const allowRegistration = process.env.ALLOW_REGISTRATION === "true"
    if (!allowRegistration) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-|apple-icon).*)",
  ],
}
