import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

// ============================
// Better Auth tables (required)
// ============================

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).default(false),
})

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
})

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
})

export const twoFactor = sqliteTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
})

// ============================
// App-specific tables
// ============================

export const connectionConfig = sqliteTable("connection_config", {
  id: text("id").primaryKey(),
  host: text("host").notNull().default("localhost"),
  port: integer("port").notNull().default(5432),
  username: text("username").notNull().default("postgres"),
  password: text("password"),
  sslMode: text("ssl_mode").default("prefer"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
})

export const backupConfig = sqliteTable("backup_config", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["s3", "gcs", "local"] }).notNull(),
  schedule: text("schedule").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRun: integer("last_run", { mode: "timestamp" }),
  databases: text("databases").notNull(), // JSON array of database names
  destination: text("destination").notNull(),
  pruningEnabled: integer("pruning_enabled", { mode: "boolean" }).notNull().default(true),
  retentionKeepLast: integer("retention_keep_last").notNull().default(7),
  retentionThinKeepEvery: integer("retention_thin_keep_every").notNull().default(30),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
})

export const storageConfig = sqliteTable("storage_config", {
  id: text("id").primaryKey(),
  provider: text("provider", { enum: ["s3", "r2"] }).notNull(),
  bucket: text("bucket").notNull(),
  region: text("region").notNull().default("us-east-1"),
  endpoint: text("endpoint"),
  accessKeyId: text("access_key_id").notNull(),
  secretAccessKey: text("secret_access_key").notNull(),
  pathPrefix: text("path_prefix").default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const accessRule = sqliteTable("access_rule", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["ip", "cidr", "header_secret"] }).notNull(),
  value: text("value").notNull(),
  description: text("description").default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const pgUserPassword = sqliteTable("pg_user_password", {
  id: text("id").primaryKey(),
  pgUsername: text("pg_username").notNull(),
  encryptedPassword: text("encrypted_password").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
})

export const queryLog = sqliteTable("query_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  database: text("database").notNull(),
  query: text("query").notNull(),
  command: text("command").notNull(), // SELECT, INSERT, UPDATE, DELETE, etc.
  rowCount: integer("row_count"),
  executionTime: integer("execution_time"), // ms
  columns: text("columns"), // JSON array of column names
  resultPreview: text("result_preview"), // JSON - first 20 rows
  error: text("error"),
  source: text("source").notNull(), // sql-editor, table-insert, table-update, table-delete
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const queryLogConfig = sqliteTable("query_log_config", {
  id: text("id").primaryKey(),
  database: text("database").notNull().unique(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  retentionDays: integer("retention_days").notNull().default(7), // 1, 7, or 30
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const alert = sqliteTable("alert", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: [
      "connection_limit_warning",
      "connection_limit_critical",
      "server_connections_warning",
      "server_connections_critical",
    ],
  }).notNull(),
  roleName: text("role_name"),
  message: text("message").notNull(),
  currentValue: integer("current_value").notNull(),
  threshold: integer("threshold").notNull(),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const snapshot = sqliteTable("snapshot", {
  id: text("id").primaryKey(),
  database: text("database").notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  sizeBytes: integer("size_bytes"),
  storageKey: text("storage_key"),
  error: text("error"),
  trigger: text("trigger", { enum: ["manual", "scheduled"] })
    .notNull()
    .default("manual"),
  backupConfigId: text("backup_config_id"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
})
