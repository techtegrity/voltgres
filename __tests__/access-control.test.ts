import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

// Mock the db module to control rules returned
const mockRules: { type: string; value: string }[] = []
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(mockRules),
      }),
    }),
  },
}))
vi.mock("@/lib/db/schema", () => ({
  accessRule: { type: "type", value: "value", enabled: "enabled" },
}))
vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ a, b }),
}))

import { isAccessAllowed, invalidateAccessRuleCache, getClientIp } from "@/lib/access-control"

function makeRequest(opts: {
  url?: string
  headers?: Record<string, string>
  ip?: string
}): NextRequest {
  const url = opts.url || "http://localhost:3000/dashboard"
  const req = new NextRequest(url, {
    headers: opts.headers,
  })
  if (opts.ip) {
    Object.defineProperty(req, "ip", { value: opts.ip })
  }
  return req
}

describe("access-control", () => {
  beforeEach(() => {
    mockRules.length = 0
    invalidateAccessRuleCache()
    delete process.env.BYPASS_TOKEN
  })

  describe("bypass token", () => {
    it("allows access via x-voltgres-bypass header", async () => {
      process.env.BYPASS_TOKEN = "secret-123"
      mockRules.push({ type: "ip", value: "10.0.0.1" }) // rule that would block us
      const req = makeRequest({
        headers: { "x-voltgres-bypass": "secret-123" },
        ip: "192.168.1.1",
      })
      expect(await isAccessAllowed(req)).toBe(true)
    })

    it("rejects wrong bypass token", async () => {
      process.env.BYPASS_TOKEN = "secret-123"
      mockRules.push({ type: "ip", value: "10.0.0.1" })
      invalidateAccessRuleCache()
      const req = makeRequest({
        headers: { "x-voltgres-bypass": "wrong-token" },
        ip: "192.168.1.1",
      })
      expect(await isAccessAllowed(req)).toBe(false)
    })

    it("does NOT allow bypass via query parameter", async () => {
      process.env.BYPASS_TOKEN = "secret-123"
      mockRules.push({ type: "ip", value: "10.0.0.1" })
      invalidateAccessRuleCache()
      const req = makeRequest({
        url: "http://localhost:3000/dashboard?bypass=secret-123",
        ip: "192.168.1.1",
      })
      expect(await isAccessAllowed(req)).toBe(false)
    })
  })

  describe("no rules = open access", () => {
    it("allows all traffic when no rules are configured", async () => {
      const req = makeRequest({ ip: "1.2.3.4" })
      expect(await isAccessAllowed(req)).toBe(true)
    })
  })

  describe("IP rules", () => {
    it("allows matching IP", async () => {
      mockRules.push({ type: "ip", value: "203.0.113.5" })
      const req = makeRequest({ ip: "203.0.113.5" })
      expect(await isAccessAllowed(req)).toBe(true)
    })

    it("blocks non-matching IP", async () => {
      mockRules.push({ type: "ip", value: "203.0.113.5" })
      invalidateAccessRuleCache()
      const req = makeRequest({ ip: "192.168.1.1" })
      expect(await isAccessAllowed(req)).toBe(false)
    })

    it("handles IPv6-mapped IPv4", async () => {
      mockRules.push({ type: "ip", value: "203.0.113.5" })
      invalidateAccessRuleCache()
      const req = makeRequest({ ip: "::ffff:203.0.113.5" })
      expect(await isAccessAllowed(req)).toBe(true)
    })
  })

  describe("CIDR rules", () => {
    it("allows IP within CIDR range", async () => {
      mockRules.push({ type: "cidr", value: "10.0.0.0/8" })
      const req = makeRequest({ ip: "10.1.2.3" })
      expect(await isAccessAllowed(req)).toBe(true)
    })

    it("blocks IP outside CIDR range", async () => {
      mockRules.push({ type: "cidr", value: "10.0.0.0/8" })
      invalidateAccessRuleCache()
      const req = makeRequest({ ip: "192.168.1.1" })
      expect(await isAccessAllowed(req)).toBe(false)
    })
  })

  describe("header_secret rules", () => {
    it("allows matching x-voltgres-token header", async () => {
      mockRules.push({ type: "header_secret", value: "my-api-key" })
      const req = makeRequest({
        headers: { "x-voltgres-token": "my-api-key" },
        ip: "1.2.3.4",
      })
      expect(await isAccessAllowed(req)).toBe(true)
    })

    it("blocks wrong token", async () => {
      mockRules.push({ type: "header_secret", value: "my-api-key" })
      invalidateAccessRuleCache()
      const req = makeRequest({
        headers: { "x-voltgres-token": "wrong" },
        ip: "1.2.3.4",
      })
      expect(await isAccessAllowed(req)).toBe(false)
    })
  })

  describe("getClientIp", () => {
    it("prefers x-forwarded-for", () => {
      const req = makeRequest({
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
        ip: "127.0.0.1",
      })
      expect(getClientIp(req)).toBe("1.2.3.4")
    })

    it("falls back to x-real-ip", () => {
      const req = makeRequest({
        headers: { "x-real-ip": "9.8.7.6" },
        ip: "127.0.0.1",
      })
      expect(getClientIp(req)).toBe("9.8.7.6")
    })

    it("falls back to request.ip", () => {
      const req = makeRequest({ ip: "10.0.0.1" })
      expect(getClientIp(req)).toBe("10.0.0.1")
    })
  })
})
