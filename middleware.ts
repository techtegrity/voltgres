import { NextRequest, NextResponse } from "next/server"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip middleware for static files, API routes, and the setup page itself
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/setup" ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|svg|jpg|jpeg|css|js)$/)
  ) {
    return NextResponse.next()
  }

  // Check if setup is needed (no users exist)
  try {
    const setupUrl = new URL("/api/setup", req.url)
    const res = await fetch(setupUrl)
    const data = await res.json()

    if (data.needsSetup) {
      // No users exist — redirect everything to /setup
      if (pathname !== "/setup") {
        return NextResponse.redirect(new URL("/setup", req.url))
      }
      return NextResponse.next()
    }
  } catch {
    // If the check fails, let the request through
    return NextResponse.next()
  }

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
