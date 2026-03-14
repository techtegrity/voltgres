import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { accessRule } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { isIP } from "node:net"

// Cache rules for 30s to avoid hitting SQLite on every request
let cachedRules: { type: string; value: string }[] | null = null
let cacheTime = 0
const CACHE_TTL = 30_000

async function getEnabledRules() {
  const now = Date.now()
  if (cachedRules && now - cacheTime < CACHE_TTL) return cachedRules

  try {
    const rules = await db
      .select({ type: accessRule.type, value: accessRule.value })
      .from(accessRule)
      .where(eq(accessRule.enabled, true))

    cachedRules = rules
    cacheTime = now
    return rules
  } catch {
    // Table may not exist yet (pre-migration) — allow all access
    return []
  }
}

export function invalidateAccessRuleCache() {
  cachedRules = null
  cacheTime = 0
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    // First IP in the chain is the original client
    return forwarded.split(",")[0].trim()
  }
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return request.ip || "unknown"
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/")
  if (!range || !bitsStr) return false
  const bits = parseInt(bitsStr, 10)
  if (isNaN(bits)) return false

  // Only handle IPv4 for now
  if (isIP(ip) !== 4 || isIP(range) !== 4) return false

  const ipNum = ipToNum(ip)
  const rangeNum = ipToNum(range)
  if (ipNum === null || rangeNum === null) return false

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipNum & mask) === (rangeNum & mask)
}

function ipToNum(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  let num = 0
  for (const part of parts) {
    const n = parseInt(part, 10)
    if (isNaN(n) || n < 0 || n > 255) return null
    num = (num << 8) | n
  }
  return num >>> 0
}

export async function isAccessAllowed(request: NextRequest): Promise<boolean> {
  // Bypass token (emergency override) — checked via header to avoid leaking in logs/referrer
  const bypassToken = process.env.BYPASS_TOKEN
  if (bypassToken) {
    const headerBypass = request.headers.get("x-voltgres-bypass")
    if (headerBypass === bypassToken) return true
  }

  const rules = await getEnabledRules()

  // No enabled rules = access control is off (safety net)
  if (rules.length === 0) return true

  const clientIp = getClientIp(request)
  const headerToken = request.headers.get("x-voltgres-token")

  for (const rule of rules) {
    switch (rule.type) {
      case "ip":
        if (clientIp === rule.value) return true
        // Handle IPv6-mapped IPv4 (e.g. ::ffff:127.0.0.1)
        if (clientIp === `::ffff:${rule.value}`) return true
        if (rule.value === `::ffff:${clientIp}`) return true
        break
      case "cidr":
        if (ipMatchesCidr(clientIp, rule.value)) return true
        // Strip ::ffff: prefix for IPv4-mapped addresses
        if (clientIp.startsWith("::ffff:")) {
          const v4 = clientIp.slice(7)
          if (ipMatchesCidr(v4, rule.value)) return true
        }
        break
      case "header_secret":
        if (headerToken && headerToken === rule.value) return true
        break
    }
  }

  return false
}

export { getClientIp }
