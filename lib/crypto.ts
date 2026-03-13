import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16
const SALT = "voltgres-credential-encryption"

function getKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required for credential encryption")
  return scryptSync(secret, SALT, 32)
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a hex-encoded string: iv + ciphertext + authTag
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return ""
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, encrypted, tag]).toString("hex")
}

/**
 * Decrypt a hex-encoded AES-256-GCM string.
 * Returns the original plaintext.
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ""
  // Handle legacy unencrypted values (not hex-encoded)
  if (!isEncrypted(ciphertext)) return ciphertext
  const key = getKey()
  const buf = Buffer.from(ciphertext, "hex")
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(buf.length - TAG_LENGTH)
  const encrypted = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final("utf8")
}

/**
 * Check if a value looks like an encrypted string (hex-encoded, minimum length).
 * Minimum length: IV(12) + at least 1 byte ciphertext + tag(16) = 29 bytes = 58 hex chars
 */
function isEncrypted(value: string): boolean {
  return value.length >= 58 && /^[0-9a-f]+$/i.test(value)
}
