async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (response.status === 401) {
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Request failed" }))
    throw new Error(body.error || `Request failed with status ${response.status}`)
  }

  return response.json()
}

// Types matching the API responses

export interface DatabaseRow {
  name: string
  owner: string
  encoding: string
  size_bytes: number
  collation: string
}

export interface PgUserRow {
  username: string
  can_login: boolean
  superuser: boolean
  create_db: boolean
  databases: string[]
}

export interface TableRow {
  name: string
  schema: string
  row_count: number
}

export interface ColumnRow {
  name: string
  type: string
  udt_type: string
  max_length: number | null
  nullable: boolean
  default_value: string | null
  is_primary_key: boolean
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTime: number
  command: string
}

export interface ConnectionConfigData {
  host: string
  port: number
  username: string
  password: string
  sslMode: string
}

export interface BackupConfigData {
  id: string
  name: string
  type: "s3" | "gcs" | "local"
  schedule: string
  enabled: boolean
  lastRun: string | null
  databases: string[]
  destination: string
}

export interface ServerInfo {
  version: string
  fullVersion: string
  uptime: string
  maxConnections: number
  activeConnections: number
}

export interface PublicConnectionInfo {
  publicHost: string | null
  publicPort: number
}

export const api = {
  databases: {
    list: () => apiFetch<DatabaseRow[]>("/api/pg/databases"),
    get: (name: string) =>
      apiFetch<DatabaseRow>(`/api/pg/databases/${encodeURIComponent(name)}`),
    create: (data: { name: string; owner: string; encoding: string }) =>
      apiFetch("/api/pg/databases", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (name: string) =>
      apiFetch(`/api/pg/databases/${encodeURIComponent(name)}`, {
        method: "DELETE",
      }),
  },

  users: {
    list: () => apiFetch<PgUserRow[]>("/api/pg/users"),
    create: (data: {
      username: string
      password: string
      superuser?: boolean
      canLogin?: boolean
    }) =>
      apiFetch("/api/pg/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (username: string) =>
      apiFetch(`/api/pg/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
      }),
    update: (
      username: string,
      data: {
        canLogin?: boolean
        superuser?: boolean
        password?: string
        grantDatabase?: string
        revokeDatabase?: string
      }
    ) =>
      apiFetch(`/api/pg/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  tables: {
    list: (db: string) =>
      apiFetch<TableRow[]>(`/api/pg/tables?db=${encodeURIComponent(db)}`),
    columns: (db: string, schema: string, table: string) =>
      apiFetch<ColumnRow[]>(
        `/api/pg/tables/columns?db=${encodeURIComponent(db)}&schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}`
      ),
  },

  sql: {
    execute: (db: string, query: string) =>
      apiFetch<QueryResult>("/api/pg/sql", {
        method: "POST",
        body: JSON.stringify({ db, query }),
      }),
  },

  config: {
    getConnection: () =>
      apiFetch<ConnectionConfigData>("/api/config/connection"),
    updateConnection: (data: ConnectionConfigData) =>
      apiFetch("/api/config/connection", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    testConnection: (data: {
      host: string
      port: number
      username: string
      password: string
      ssl?: boolean
    }) =>
      apiFetch<{ success: boolean; version?: string; error?: string }>(
        "/api/pg/test-connection",
        { method: "POST", body: JSON.stringify(data) }
      ),
    getPublicConnection: () =>
      apiFetch<PublicConnectionInfo>("/api/config/public-connection"),
  },

  backups: {
    list: () => apiFetch<BackupConfigData[]>("/api/config/backups"),
    create: (data: {
      name: string
      type: string
      schedule: string
      enabled?: boolean
      databases: string[]
      destination: string
    }) =>
      apiFetch<{ id: string }>("/api/config/backups", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<BackupConfigData>) =>
      apiFetch(`/api/config/backups/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch(`/api/config/backups/${id}`, { method: "DELETE" }),
  },

  server: {
    info: () => apiFetch<ServerInfo>("/api/pg/server-info"),
  },
}
