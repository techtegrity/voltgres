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
  active_connections: number
  xact_commit: number
  xact_rollback: number
  cache_hit_ratio: number
  tup_returned: number
  tup_fetched: number
  tup_inserted: number
  tup_updated: number
  tup_deleted: number
}

export interface PgUserRow {
  username: string
  can_login: boolean
  superuser: boolean
  create_db: boolean
  databases: string[]
}

export interface DatabaseUserPrivileges {
  username: string
  is_owner: boolean
  superuser: boolean
  can_login: boolean
  connect: boolean
  create: boolean
  temporary: boolean
  connection_limit: number
}

export interface UserDatabasePrivileges {
  username: string
  database: string
  is_owner: boolean
  superuser: boolean
  connect: boolean
  create: boolean
  temporary: boolean
}

export interface ConnectionActivity {
  pid: number
  usename: string | null
  application_name: string
  client_addr: string | null
  state: string | null
  query: string | null
  query_start: string | null
  state_change: string | null
  backend_start: string | null
  wait_event_type: string | null
  wait_event: string | null
}

export interface TableRow {
  name: string
  schema: string
  row_count: number
  owner: string
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

export interface TableFilter {
  column: string
  operator: string
  value?: string
}

export interface TableDataResult {
  rows: Record<string, unknown>[]
  columns: string[]
  columnMeta: ColumnRow[]
  totalCount: number
  page: number
  pageSize: number
  executionTime: number
}

export interface StorageConfigData {
  id: string
  provider: "s3" | "r2"
  bucket: string
  region: string
  endpoint: string | null
  accessKeyId: string
  secretAccessKey: string
  pathPrefix: string
}

export interface SnapshotData {
  id: string
  database: string
  status: "pending" | "running" | "completed" | "failed"
  sizeBytes: number | null
  storageKey: string | null
  error: string | null
  trigger: "manual" | "scheduled"
  backupConfigId: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  userId: string
}

export interface SystemMetrics {
  cpu: {
    cores: number
    model: string
    usagePercent: number
    loadAvg: number[]
  }
  memory: {
    totalBytes: number
    usedBytes: number
    freeBytes: number
    usagePercent: number
  }
  disk: {
    totalBytes: number
    usedBytes: number
    freeBytes: number
    usagePercent: number
    mountPoint: string
  }
  uptime: number
  timestamp: number
}

export interface ProcessEntry {
  pid: number
  user: string
  cpuPercent: number
  memPercent: number
  rssBytes: number
  vsz: number
  command: string
}

export interface ProcessesData {
  topByCpu: ProcessEntry[]
  topByMemory: ProcessEntry[]
  cpuInfo: {
    cores: number
    model: string
    loadAvg: number[]
  }
  memoryBreakdown: {
    total: number
    free: number
    available: number
    buffers: number
    cached: number
    swapTotal: number
    swapFree: number
    shmem: number
    sreclaimable: number
  }
}

export interface DiskUsageEntry {
  path: string
  label: string
  bytes: number
  percent: number
}

export interface DiskUsageData {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  entries: DiskUsageEntry[]
  pgDataBytes: number
}

export interface DockerTypeUsage {
  total: number
  active: number
  size: number
  reclaimable: number
}

export interface DockerUsageData {
  available: boolean
  buildCache: DockerTypeUsage
  images: DockerTypeUsage
  containers: DockerTypeUsage
  volumes: DockerTypeUsage
}

export interface DockerPruneResult {
  reclaimedBytes: number
  message: string
}

export interface TablePrivilegeRow {
  schema: string
  table_name: string
  table_owner: string
  username: string
  superuser: boolean
  is_table_owner: boolean
  select: boolean
  insert: boolean
  update: boolean
  delete: boolean
  truncate: boolean
  references: boolean
  trigger: boolean
}

export interface PgStatStatementEntry {
  queryid: string
  query: string
  calls: number
  total_exec_time: number
  mean_exec_time: number
  min_exec_time: number
  max_exec_time: number
  rows: number
  shared_blks_hit: number
  shared_blks_read: number
  dbname: string | null
  rolname: string | null
}

export interface PgStatStatementsResult {
  available: boolean
  reason?: "not_preloaded" | "install_failed"
  entries: PgStatStatementEntry[]
}

export interface QueryLogEntry {
  id: string
  userId: string
  database: string
  query: string
  command: string
  rowCount: number | null
  executionTime: number | null
  columns: string[] | null
  error: string | null
  source: string
  createdAt: string
}

export interface QueryLogDetail extends QueryLogEntry {
  resultPreview: Record<string, unknown>[] | null
}

export interface QueryLogListResult {
  entries: QueryLogEntry[]
  totalCount: number
  page: number
  pageSize: number
}

export interface QueryLogStatsEntry {
  database: string
  entryCount: number
  estimatedSizeBytes: number
  oldestEntry: string | null
  newestEntry: string | null
  retentionDays: number
  enabled: boolean
}

export interface QueryLogConfigData {
  database: string
  enabled: boolean
  retentionDays: number
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
    checkOwnership: (name: string) =>
      apiFetch<{ misconfiguredCount: number }>(
        `/api/pg/databases/${encodeURIComponent(name)}/fix-ownership`
      ),
    fixOwnership: (name: string) =>
      apiFetch(`/api/pg/databases/${encodeURIComponent(name)}/fix-ownership`, {
        method: "POST",
      }),
    privileges: (name: string) =>
      apiFetch<DatabaseUserPrivileges[]>(
        `/api/pg/databases/${encodeURIComponent(name)}/privileges`
      ),
    updatePrivilege: (
      name: string,
      data: {
        username: string
        privilege?: string
        action?: "grant" | "revoke"
        connectionLimit?: number
      }
    ) =>
      apiFetch(`/api/pg/databases/${encodeURIComponent(name)}/privileges`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    tablePrivileges: (name: string) =>
      apiFetch<TablePrivilegeRow[]>(
        `/api/pg/databases/${encodeURIComponent(name)}/table-privileges`
      ),
    updateTablePrivilege: (
      name: string,
      data: {
        username: string
        schema: string
        table: string
        privilege?: string
        action: "grant" | "revoke" | "transfer_ownership"
      }
    ) =>
      apiFetch(`/api/pg/databases/${encodeURIComponent(name)}/table-privileges`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    activity: (name: string) =>
      apiFetch<ConnectionActivity[]>(
        `/api/pg/databases/${encodeURIComponent(name)}/activity`
      ),
    terminateConnection: (name: string, pid: number) =>
      apiFetch(`/api/pg/databases/${encodeURIComponent(name)}/activity`, {
        method: "DELETE",
        body: JSON.stringify({ pid }),
      }),
    reset: (name: string) =>
      apiFetch(`/api/pg/databases/${encodeURIComponent(name)}/reset`, {
        method: "POST",
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
    privileges: () =>
      apiFetch<UserDatabasePrivileges[]>("/api/pg/users/privileges"),
  },

  tables: {
    list: (db: string) =>
      apiFetch<TableRow[]>(`/api/pg/tables?db=${encodeURIComponent(db)}`),
    columns: (db: string, schema: string, table: string) =>
      apiFetch<ColumnRow[]>(
        `/api/pg/tables/columns?db=${encodeURIComponent(db)}&schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}`
      ),
    rows: (
      db: string,
      schema: string,
      table: string,
      opts: {
        page?: number
        pageSize?: number
        sort?: string
        sortDir?: "asc" | "desc"
        filters?: TableFilter[]
        columns?: string[]
      } = {}
    ) => {
      const params = new URLSearchParams({
        db,
        schema,
        table,
        page: String(opts.page ?? 1),
        pageSize: String(opts.pageSize ?? 50),
      })
      if (opts.sort) params.set("sort", opts.sort)
      if (opts.sortDir) params.set("sortDir", opts.sortDir)
      if (opts.filters?.length)
        params.set("filters", JSON.stringify(opts.filters))
      if (opts.columns?.length)
        params.set("columns", opts.columns.join(","))
      return apiFetch<TableDataResult>(`/api/pg/tables/rows?${params}`)
    },
    insertRow: (
      db: string,
      schema: string,
      table: string,
      data: Record<string, unknown>
    ) =>
      apiFetch<Record<string, unknown>>("/api/pg/tables/rows", {
        method: "POST",
        body: JSON.stringify({ db, schema, table, data }),
      }),
    updateRow: (
      db: string,
      schema: string,
      table: string,
      pkValues: Record<string, unknown>,
      data: Record<string, unknown>
    ) =>
      apiFetch<Record<string, unknown>>("/api/pg/tables/rows", {
        method: "PATCH",
        body: JSON.stringify({ db, schema, table, pkValues, data }),
      }),
    deleteRows: (
      db: string,
      schema: string,
      table: string,
      pkValueSets: Record<string, unknown>[]
    ) =>
      apiFetch<{ deletedCount: number }>("/api/pg/tables/rows", {
        method: "DELETE",
        body: JSON.stringify({ db, schema, table, pkValueSets }),
      }),
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
    revealConnectionPassword: () =>
      apiFetch<{ password: string }>("/api/config/connection/password"),
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

  userPasswords: {
    /** Fetch all stored PG user passwords (decrypted) for current user */
    list: () => apiFetch<Record<string, string>>("/api/pg/user-passwords"),
    /** Store or update a PG user password */
    save: (username: string, password: string) =>
      apiFetch<{ success: boolean }>("/api/pg/user-passwords", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
  },

  server: {
    info: () => apiFetch<ServerInfo>("/api/pg/server-info"),
  },

  system: {
    metrics: () => apiFetch<SystemMetrics>("/api/system/metrics"),
    diskUsage: () => apiFetch<DiskUsageData>("/api/system/disk-usage"),
    dockerUsage: () => apiFetch<DockerUsageData>("/api/system/docker-usage"),
    dockerPrune: (target: "build-cache" | "images" | "all") =>
      apiFetch<DockerPruneResult>("/api/system/docker-prune", {
        method: "POST",
        body: JSON.stringify({ target }),
      }),
    processes: () => apiFetch<ProcessesData>("/api/system/processes"),
  },

  storage: {
    get: () => apiFetch<StorageConfigData | null>("/api/config/storage"),
    save: (data: {
      provider: string
      bucket: string
      region?: string
      endpoint?: string
      accessKeyId: string
      secretAccessKey: string
      pathPrefix?: string
    }) =>
      apiFetch<{ success: boolean }>("/api/config/storage", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    test: (data: {
      provider: string
      bucket: string
      region?: string
      endpoint?: string
      accessKeyId: string
      secretAccessKey: string
    }) =>
      apiFetch<{ success: boolean; error?: string }>(
        "/api/config/storage/test",
        { method: "POST", body: JSON.stringify(data) }
      ),
    delete: () =>
      apiFetch<{ success: boolean }>("/api/config/storage", {
        method: "DELETE",
      }),
  },

  import: {
    testConnection: (data: {
      host: string
      port: number
      user: string
      password: string
      database: string
      ssl?: boolean
    }) =>
      apiFetch<{
        success: boolean
        version?: string
        database?: string
        error?: string
      }>("/api/pg/import/test-connection", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listTables: (data: {
      host: string
      port: number
      user: string
      password: string
      database: string
      ssl?: boolean
    }) =>
      apiFetch<
        { schema: string; name: string; rowCount: number; sizeBytes: number }[]
      >("/api/pg/import/tables", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  statStatements: {
    get: (opts?: { db?: string; search?: string; limit?: number }) => {
      const params = new URLSearchParams()
      if (opts?.db) params.set("db", opts.db)
      if (opts?.search) params.set("search", opts.search)
      if (opts?.limit) params.set("limit", String(opts.limit))
      const qs = params.toString()
      return apiFetch<PgStatStatementsResult>(
        `/api/pg/stat-statements${qs ? `?${qs}` : ""}`
      )
    },
    enable: () =>
      apiFetch<{ success: boolean }>("/api/pg/stat-statements", {
        method: "POST",
        body: JSON.stringify({ action: "enable" }),
      }),
    reset: () =>
      apiFetch<{ success: boolean }>("/api/pg/stat-statements", {
        method: "POST",
        body: JSON.stringify({ action: "reset" }),
      }),
  },

  queryLog: {
    list: (opts?: { db?: string; search?: string; page?: number; pageSize?: number }) => {
      const params = new URLSearchParams()
      if (opts?.db) params.set("db", opts.db)
      if (opts?.search) params.set("search", opts.search)
      if (opts?.page) params.set("page", String(opts.page))
      if (opts?.pageSize) params.set("pageSize", String(opts.pageSize))
      const qs = params.toString()
      return apiFetch<QueryLogListResult>(`/api/pg/query-log${qs ? `?${qs}` : ""}`)
    },
    get: (id: string) => apiFetch<QueryLogDetail>(`/api/pg/query-log/${id}`),
    stats: () => apiFetch<QueryLogStatsEntry[]>("/api/pg/query-log/stats"),
    getConfig: (db: string) =>
      apiFetch<QueryLogConfigData>(`/api/pg/query-log/config?db=${encodeURIComponent(db)}`),
    updateConfig: (data: { database: string; enabled?: boolean; retentionDays?: number }) =>
      apiFetch<QueryLogConfigData>("/api/pg/query-log/config", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },

  snapshots: {
    list: (db?: string) =>
      apiFetch<SnapshotData[]>(
        db
          ? `/api/snapshots?db=${encodeURIComponent(db)}`
          : "/api/snapshots"
      ),
    create: (database: string) =>
      apiFetch<{ id: string; status: string }>("/api/snapshots", {
        method: "POST",
        body: JSON.stringify({ database }),
      }),
    get: (id: string) => apiFetch<SnapshotData>(`/api/snapshots/${id}`),
    delete: (id: string) =>
      apiFetch(`/api/snapshots/${id}`, { method: "DELETE" }),
    downloadUrl: (id: string) => `/api/snapshots/${id}/download`,
    restore: (id: string, targetDatabase?: string) =>
      apiFetch<{ success: boolean; message: string }>(
        `/api/snapshots/${id}/restore`,
        {
          method: "POST",
          body: JSON.stringify({ targetDatabase }),
        }
      ),
  },
}
