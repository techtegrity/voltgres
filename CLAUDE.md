# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Voltgres is a self-hosted PostgreSQL administration tool built with Next.js 16 (App Router) + React 19, using SQLite for its own config/state and connecting to target PostgreSQL instances. Deployed via Docker Compose on a VPS.

## Commands

```bash
pnpm dev               # Dev server on port 3042
pnpm build             # Production build
pnpm test              # Run vitest
pnpm lint              # ESLint
pnpm db:generate       # Generate Drizzle migration from schema changes
pnpm db:migrate        # Apply migrations
pnpm db:push           # Push schema directly (dev only)
pnpm db:studio         # Drizzle Studio GUI
pnpm docker:fresh      # Tear down and rebuild all containers
```

## Architecture

**Two databases:**
- **SQLite** (`voltgres.db`, WAL mode) — stores auth sessions, connection configs, backup schedules, access rules, query logs, alerts. Schema in `lib/db/schema.ts` (17 tables), managed by Drizzle ORM.
- **PostgreSQL** (target) — the user's database(s) being administered. Connected via `pg` library with per-config connection pooling (`lib/pg/connection.ts`, max 5 per pool).

**Auth:** `better-auth` with SQLite adapter, optional Google OAuth, optional TOTP 2FA. 4-hour sessions. Server-side session check via `getServerSession()` from `lib/auth-server.ts`.

**Credential encryption:** AES-256-GCM (`lib/crypto.ts`), key derived from `BETTER_AUTH_SECRET` via scryptSync. Used for stored PostgreSQL passwords, S3 keys.

**Request flow:** `proxy.ts` acts as middleware — handles access control (IP/CIDR/header token rules from `lib/access-control.ts`, 30s cache), rate limiting (`lib/rate-limit.ts`, in-memory sliding window), and auth redirects. Not `middleware.ts`.

**Background jobs** initialized in `instrumentation.ts` on server startup:
- Backup scheduler (`lib/snapshots/scheduler.ts`) — node-cron, pg_dump/pg_restore
- Connection monitor (`lib/monitoring/connection-monitor.ts`) — 60s interval, alerts at 80%/90%
- Docker cleanup (`lib/docker-cleanup.ts`) — daily build cache prune

**Docker services** (docker-compose.yml): voltgres (Next.js), postgres (16-alpine), pgbouncer (transaction mode, TLS required), fail2ban (auto-bans failed auth IPs via DOCKER-USER iptables chain), caddy (optional HTTPS profile).

## Key Patterns

**API routes** — all in `app/api/`. Always start with session check:
```typescript
const session = await getServerSession()
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
```

**Database queries** use Drizzle ORM:
```typescript
import { db } from "@/lib/db"
import { someTable } from "@/lib/db/schema"
const rows = db.select().from(someTable).where(eq(someTable.userId, userId))
```

**PostgreSQL operations** get a pool via `getUserPoolForDb(userId, dbName)` from `lib/api/get-pg-pool.ts`.

**Path alias:** `@/*` maps to project root.

## Deployment

- `install.sh` — interactive first-time setup (generates .env, builds containers)
- `update.sh` — git pull + rebuild (the standard deploy flow)
- `docker-compose.port-migration.yml` — override for running both old and new PostgreSQL ports during migration
- Caddy auto-provisions Let's Encrypt certs when `DOMAIN` is set and `--profile https` is used
