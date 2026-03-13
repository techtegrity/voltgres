const KNOWN_WEAK_SECRETS = [
  "change-me-generate-a-random-secret",
  "secret",
  "password",
  "changeme",
]

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Warn loudly if using a known default/weak auth secret
    const authSecret = process.env.BETTER_AUTH_SECRET
    if (!authSecret || KNOWN_WEAK_SECRETS.includes(authSecret)) {
      console.error(
        "\n⚠️  WARNING: BETTER_AUTH_SECRET is missing or set to a known weak value!\n" +
          "   Sessions can be forged by anyone who knows this value.\n" +
          "   Generate a strong secret: openssl rand -base64 32\n"
      )
    }

    const { initScheduler } = await import("@/lib/snapshots/scheduler")
    initScheduler()

    const { initDockerCleanup } = await import("@/lib/docker-cleanup")
    initDockerCleanup()
  }
}
