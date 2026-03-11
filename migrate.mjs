import Database from "better-sqlite3"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"

const dbPath = process.env.VOLTGRES_DB_PATH || "voltgres.db"
const db = new Database(dbPath)
db.pragma("journal_mode = WAL")

// Create migrations tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`)

// Read and apply migrations in order
const migrationsDir = join(import.meta.dirname, "drizzle")
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()

for (const file of files) {
  const applied = db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get(file)
  if (applied) continue

  console.log(`Applying migration: ${file}`)
  const sql = readFileSync(join(migrationsDir, file), "utf-8")

  // Split on drizzle's statement breakpoint marker
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)

  const migrate = db.transaction(() => {
    for (const stmt of statements) {
      db.exec(stmt)
    }
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file)
  })

  migrate()
  console.log(`Applied: ${file}`)
}

console.log("Migrations complete.")
db.close()
