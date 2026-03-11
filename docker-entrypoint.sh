#!/bin/sh
set -e

echo "Voltgres starting..."

# Run database migrations (creates SQLite tables if they don't exist)
echo "Running database migrations..."
node migrate.mjs
echo "Migrations complete."

# Start the Next.js server
exec node server.js
