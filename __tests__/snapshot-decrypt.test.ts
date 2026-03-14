import { describe, it, expect, vi } from "vitest"
import { encrypt, decrypt } from "@/lib/crypto"

// Set a test secret for encryption
process.env.BETTER_AUTH_SECRET = "test-secret-for-snapshot-decrypt-tests"

describe("snapshot password decryption", () => {
  it("encrypt then decrypt round-trips correctly", () => {
    const password = "my-pg-password-123"
    const encrypted = encrypt(password)
    expect(encrypted).not.toBe(password)
    expect(encrypted).toMatch(/^[0-9a-f]+$/i)
    expect(decrypt(encrypted)).toBe(password)
  })

  it("decrypt passes through unencrypted legacy values", () => {
    expect(decrypt("plaintext-password")).toBe("plaintext-password")
  })

  it("decrypt returns empty string for empty input", () => {
    expect(decrypt("")).toBe("")
  })

  it("execute.ts imports and uses decrypt for PGPASSWORD", async () => {
    const source = await import("fs").then((fs) =>
      fs.readFileSync("lib/snapshots/execute.ts", "utf-8")
    )
    expect(source).toContain('import { decrypt } from "@/lib/crypto"')
    expect(source).toContain("decrypt(pgConfig.password)")
    // Should NOT have bare pgConfig.password assigned to PGPASSWORD
    expect(source).not.toMatch(/PGPASSWORD\s*=\s*pgConfig\.password\s*[;\n]/)
  })

  it("restore.ts imports and uses decrypt for PGPASSWORD", async () => {
    const source = await import("fs").then((fs) =>
      fs.readFileSync("lib/snapshots/restore.ts", "utf-8")
    )
    expect(source).toContain('import { decrypt } from "@/lib/crypto"')
    expect(source).toContain("decrypt(pgConfig.password)")
    // Should NOT have bare pgConfig.password assigned to PGPASSWORD
    expect(source).not.toMatch(/PGPASSWORD\s*=\s*pgConfig\.password\s*[;\n]/)
  })
})
