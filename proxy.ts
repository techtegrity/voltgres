import { NextRequest, NextResponse } from "next/server"
import { isAccessAllowed, getClientIp } from "@/lib/access-control"
import { checkRateLimit } from "@/lib/rate-limit"

const BLOCKED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Denied - Voltgres</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #09090b;
      color: #fafafa;
    }
    .container {
      text-align: center;
      max-width: 420px;
      padding: 2rem;
    }
    .icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1.5rem;
      border-radius: 12px;
      background: rgba(239, 68, 68, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg { width: 24px; height: 24px; color: #ef4444; }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    p { color: #a1a1aa; font-size: 0.875rem; line-height: 1.5; }
    .code { margin-top: 1rem; color: #52525b; font-size: 0.75rem; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    </div>
    <h1>Access Denied</h1>
    <p>Your IP address is not authorized to access this Voltgres instance. Contact the administrator if you believe this is an error.</p>
    <p class="code">403 Forbidden</p>
  </div>
</body>
</html>`

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow health check endpoint (for uptime monitors)
  if (pathname === "/api/health") {
    return NextResponse.next()
  }

  // Access control check
  const allowed = await isAccessAllowed(req)
  if (!allowed) {
    return new NextResponse(BLOCKED_HTML, {
      status: 403,
      headers: { "Content-Type": "text/html" },
    })
  }

  // Rate limit setup and SQL endpoints (auth endpoints are rate-limited by Better Auth)
  if (pathname === "/api/setup") {
    const ip = getClientIp(req)
    const limit = checkRateLimit(`setup:${ip}`, { max: 5, windowMs: 60_000 })
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(limit.resetMs / 1000)),
          },
        }
      )
    }
  }

  // Rate limit SQL execution endpoint
  if (pathname === "/api/pg/sql") {
    const ip = getClientIp(req)
    const limit = checkRateLimit(`sql:${ip}`, { max: 30, windowMs: 60_000 })
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(limit.resetMs / 1000)),
          },
        }
      )
    }
  }

  // Block public registration when disabled (both UI and API)
  const allowRegistration = process.env.ALLOW_REGISTRATION === "true"
  if (!allowRegistration) {
    if (pathname === "/signup") {
      return NextResponse.redirect(new URL("/login", req.url))
    }
    // Block all Better Auth sign-up API endpoints
    if (pathname.startsWith("/api/auth/sign-up")) {
      return NextResponse.json(
        { error: "Registration is disabled" },
        { status: 403 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-|apple-icon).*)",
  ],
}
