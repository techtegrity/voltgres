# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  else npm install; \
  fi

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_GOOGLE_ENABLED=false
ENV NEXT_PUBLIC_GOOGLE_ENABLED=$NEXT_PUBLIC_GOOGLE_ENABLED
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build (includes node_modules with better-sqlite3)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy migration script and SQL files
COPY --from=builder /app/migrate.mjs ./migrate.mjs
COPY --from=builder /app/drizzle ./drizzle

# Install pg_dump/pg_restore for snapshots, docker-cli for disk management, su-exec for user switching
RUN apk add --no-cache postgresql16-client docker-cli su-exec

# Create data directory for SQLite and tmp for snapshots
RUN mkdir -p /app/data /app/tmp && chown nextjs:nodejs /app/data /app/tmp

# Copy startup script (runs as root, drops to nextjs via su-exec)
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Entrypoint runs as root to detect docker socket GID, then drops to nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
