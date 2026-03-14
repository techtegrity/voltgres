import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock getServerSession before importing route handlers
const mockGetServerSession = vi.fn()
vi.mock("@/lib/auth-server", () => ({
  getServerSession: () => mockGetServerSession(),
}))

// Mock child_process and fs to avoid real system calls
vi.mock("node:child_process", () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.startsWith("df "))
      return "Filesystem  1K-blocks    Used Available Use% Mounted on\n/dev/sda1   100000000 50000000  50000000  50% /\n"
    if (cmd.startsWith("cat /proc/stat"))
      return "cpu  1000 200 300 5000 100 0 0 0 0 0\n"
    if (cmd.startsWith("ps "))
      return "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nroot         1  0.0  0.0   1000   500 ?        Ss   Jan01   0:00 init\n"
    if (cmd.startsWith("cat /proc/meminfo"))
      return "MemTotal:       16000000 kB\nMemFree:         8000000 kB\nMemAvailable:   10000000 kB\n"
    if (cmd.startsWith("cat /proc/loadavg"))
      return "0.50 0.40 0.30 1/100 1234\n"
    if (cmd.startsWith("grep"))
      return "4\nmodel name\t: Test CPU\n"
    if (cmd.startsWith("du "))
      return "1000000\t/var\n"
    return ""
  }),
  execFileSync: vi.fn(() => ""),
}))
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
}))

describe("system API auth guards", () => {
  beforeEach(() => {
    mockGetServerSession.mockReset()
  })

  describe("GET /api/system/metrics", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetServerSession.mockResolvedValue(null)
      const { GET } = await import("@/app/api/system/metrics/route")
      const res = await GET()
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("Unauthorized")
    })

    it("returns 200 with data when authenticated", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } })
      const { GET } = await import("@/app/api/system/metrics/route")
      const res = await GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty("cpu")
      expect(body).toHaveProperty("memory")
      expect(body).toHaveProperty("uptime")
    })
  })

  describe("GET /api/system/disk-usage", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetServerSession.mockResolvedValue(null)
      const { GET } = await import("@/app/api/system/disk-usage/route")
      const res = await GET()
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("Unauthorized")
    })

    it("returns 200 when authenticated", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } })
      const { GET } = await import("@/app/api/system/disk-usage/route")
      const res = await GET()
      expect(res.status).toBe(200)
    })
  })

  describe("GET /api/system/processes", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetServerSession.mockResolvedValue(null)
      const { GET } = await import("@/app/api/system/processes/route")
      const res = await GET()
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("Unauthorized")
    })

    it("returns 200 when authenticated", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } })
      const { GET } = await import("@/app/api/system/processes/route")
      const res = await GET()
      expect(res.status).toBe(200)
    })
  })

  describe("GET /api/system/docker-usage", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetServerSession.mockResolvedValue(null)
      const { GET } = await import("@/app/api/system/docker-usage/route")
      const res = await GET()
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("Unauthorized")
    })

    it("returns 200 when authenticated", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } })
      const { GET } = await import("@/app/api/system/docker-usage/route")
      const res = await GET()
      expect(res.status).toBe(200)
    })
  })

  describe("POST /api/system/docker-prune", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetServerSession.mockResolvedValue(null)
      const { POST } = await import("@/app/api/system/docker-prune/route")
      const req = new Request("http://localhost/api/system/docker-prune", {
        method: "POST",
        body: JSON.stringify({ target: "all" }),
        headers: { "Content-Type": "application/json" },
      })
      const res = await POST(req)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("Unauthorized")
    })
  })
})
