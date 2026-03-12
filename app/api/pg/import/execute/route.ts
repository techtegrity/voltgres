import { NextRequest } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getUserPool, getUserPoolForDb } from "@/lib/api/get-pg-pool"
import { createDatabase, regrantDatabaseSchemas } from "@/lib/pg/queries"
import {
  createTemporaryPool,
  getForeignKeyDependencies,
  orderTablesByDependencies,
  importTable,
  getTableSchema,
  buildAddForeignKeysSQL,
  type TableSelection,
  type TableImportProgress,
  type ForeignKeyDef,
} from "@/lib/pg/import"

export const dynamic = "force-dynamic"

interface ImportRequest {
  source: {
    host: string
    port: number
    user: string
    password: string
    database: string
    ssl?: boolean
  }
  tables: TableSelection[]
  target: {
    mode: "existing" | "new"
    database?: string
    newDatabaseName?: string
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  let body: ImportRequest
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { source, tables, target } = body

  if (!source?.host || !source?.database || !tables?.length) {
    return new Response(
      JSON.stringify({ error: "source connection, tables, and target are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const sourcePool = createTemporaryPool({
        host: source.host,
        port: source.port,
        user: source.user,
        password: source.password,
        database: source.database,
        ssl: source.ssl,
      })

      try {
        // Determine target database
        let targetDbName: string
        if (target.mode === "new" && target.newDatabaseName) {
          // Create the new database first
          const adminPool = await getUserPool(session.user.id)
          if (!adminPool) {
            send({ type: "error", message: "No PostgreSQL connection configured" })
            controller.close()
            return
          }
          try {
            await createDatabase(adminPool, target.newDatabaseName, source.user, "UTF8")
          } catch (error) {
            send({
              type: "error",
              message: `Failed to create database: ${(error as Error).message}`,
            })
            controller.close()
            return
          }
          targetDbName = target.newDatabaseName
        } else if (target.database) {
          targetDbName = target.database
        } else {
          send({ type: "error", message: "No target database specified" })
          controller.close()
          return
        }

        const targetPool = await getUserPoolForDb(session.user.id, targetDbName)
        if (!targetPool) {
          send({ type: "error", message: "Could not connect to target database" })
          controller.close()
          return
        }

        // Order tables by FK dependencies
        const deps = await getForeignKeyDependencies(sourcePool, tables)
        const orderedTables = orderTablesByDependencies(tables, deps)

        send({
          type: "start",
          totalTables: orderedTables.length,
          tables: orderedTables.map((t) => `${t.schema}.${t.name}`),
        })

        // Import tables
        let imported = 0
        let failed = 0
        let totalRowsImported = 0
        const allForeignKeys: { table: TableSelection; fks: ForeignKeyDef[] }[] = []

        for (let i = 0; i < orderedTables.length; i++) {
          const table = orderedTables[i]

          const onProgress = (progress: TableImportProgress) => {
            send({
              type: "progress",
              tableIndex: i,
              schema: progress.schema,
              table: progress.table,
              phase: progress.phase,
              rowsImported: progress.rowsImported,
              totalRows: progress.totalRows,
              error: progress.error,
            })
          }

          try {
            // Get row count estimate for progress
            const countResult = await sourcePool.query(
              `SELECT reltuples::bigint AS count FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = $1 AND c.relname = $2`,
              [table.schema, table.name]
            )
            const totalRows = Math.max(0, Number(countResult.rows[0]?.count || 0))

            const result = await importTable(sourcePool, targetPool, table, totalRows, onProgress)
            allForeignKeys.push({ table, fks: result.foreignKeys })

            imported++
            totalRowsImported += totalRows
            send({
              type: "table_complete",
              tableIndex: i,
              schema: table.schema,
              table: table.name,
            })
          } catch (error) {
            failed++
            send({
              type: "table_error",
              tableIndex: i,
              schema: table.schema,
              table: table.name,
              error: (error as Error).message,
            })
          }
        }

        // Final pass: add foreign keys
        let fkErrors = 0
        for (const { table, fks } of allForeignKeys) {
          if (fks.length === 0) continue
          const schema = await getTableSchema(sourcePool, table.schema, table.name)
          const fkStatements = buildAddForeignKeysSQL(schema)
          for (const stmt of fkStatements) {
            try {
              await targetPool.query(stmt)
            } catch {
              fkErrors++
            }
          }
        }

        // Re-grant schema privileges to DB owner and all granted users.
        // Import runs as admin so imported schemas/tables are owned by postgres.
        const grantPool = await getUserPool(session.user.id)
        if (grantPool) {
          try {
            await regrantDatabaseSchemas(grantPool, targetDbName)
          } catch (error) {
            send({ type: "warning", message: `Schema grants: ${(error as Error).message}` })
          }
        }

        send({
          type: "complete",
          summary: {
            imported,
            failed,
            totalRowsImported,
            fkErrors,
          },
        })
      } catch (error) {
        send({ type: "error", message: (error as Error).message })
      } finally {
        await sourcePool.end()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
