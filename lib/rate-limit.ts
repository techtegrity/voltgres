/**
 * Simple in-memory sliding window rate limiter.
 * Keyed by IP address, configurable per route group.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 600_000)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}, 300_000).unref()

interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  max: number
  /** Window size in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetMs: number
}

/**
 * Check if a request should be rate limited.
 * @param key Unique key (typically `prefix:ip`)
 * @param options Rate limit configuration
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key) || { timestamps: [] }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < options.windowMs)

  if (entry.timestamps.length >= options.max) {
    const oldestInWindow = entry.timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestInWindow + options.windowMs - now,
    }
  }

  entry.timestamps.push(now)
  store.set(key, entry)

  return {
    allowed: true,
    remaining: options.max - entry.timestamps.length,
    resetMs: options.windowMs,
  }
}
