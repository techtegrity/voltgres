"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { api, type TableFilter, type ColumnRow } from "@/lib/api-client"

export interface UseTableDataReturn {
  // Data
  rows: Record<string, unknown>[]
  columns: string[]
  columnMeta: ColumnRow[]
  totalCount: number
  executionTime: number
  loading: boolean
  error: string | null
  hasPrimaryKey: boolean
  primaryKeys: string[]

  // Pagination
  page: number
  pageSize: number
  totalPages: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void

  // Sorting
  sort: string | undefined
  sortDir: "asc" | "desc"
  setSort: (column: string | undefined, dir?: "asc" | "desc") => void
  toggleSort: (column: string) => void

  // Filtering
  filters: TableFilter[]
  setFilters: (filters: TableFilter[]) => void
  addFilter: (filter: TableFilter) => void
  removeFilter: (index: number) => void
  clearFilters: () => void

  // Column visibility
  visibleColumns: string[]
  setVisibleColumns: (columns: string[]) => void
  toggleColumn: (column: string) => void

  // Row selection
  selectedRows: Set<string>
  toggleRowSelection: (rowKey: string) => void
  toggleAllOnPage: () => void
  clearSelection: () => void

  // CRUD
  insertRow: (data: Record<string, unknown>) => Promise<void>
  updateRow: (
    pkValues: Record<string, unknown>,
    data: Record<string, unknown>
  ) => Promise<void>
  deleteRows: (pkValueSets: Record<string, unknown>[]) => Promise<void>

  // Misc
  refresh: () => Promise<void>
  getRowKey: (row: Record<string, unknown>) => string
}

export function useTableData(
  dbName: string,
  schema: string,
  tableName: string | null
): UseTableDataReturn {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [columnMeta, setColumnMeta] = useState<ColumnRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [executionTime, setExecutionTime] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sort, setSortCol] = useState<string | undefined>(undefined)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [filters, setFilters] = useState<TableFilter[]>([])
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const prevTable = useRef<string | null>(null)

  // Derived
  const primaryKeys = columnMeta
    .filter((c) => c.is_primary_key)
    .map((c) => c.name)
  const hasPrimaryKey = primaryKeys.length > 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const getRowKey = useCallback(
    (row: Record<string, unknown>) => {
      if (primaryKeys.length > 0) {
        return JSON.stringify(primaryKeys.map((pk) => row[pk]))
      }
      return JSON.stringify(row)
    },
    [primaryKeys]
  )

  const fetchRows = useCallback(async () => {
    if (!tableName) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.tables.rows(dbName, schema, tableName, {
        page,
        pageSize,
        sort,
        sortDir,
        filters: filters.length > 0 ? filters : undefined,
      })
      setRows(result.rows)
      setColumns(result.columns)
      setColumnMeta(result.columnMeta)
      setTotalCount(result.totalCount)
      setExecutionTime(result.executionTime)

      // Initialize visible columns on first load
      if (visibleColumns.length === 0 && result.columns.length > 0) {
        setVisibleColumns(result.columns)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dbName, schema, tableName, page, pageSize, sort, sortDir, filters, visibleColumns.length])

  // Reset state when table changes
  useEffect(() => {
    if (tableName !== prevTable.current) {
      prevTable.current = tableName
      setPage(1)
      setSortCol(undefined)
      setSortDir("asc")
      setFilters([])
      setVisibleColumns([])
      setSelectedRows(new Set())
      setRows([])
      setColumns([])
      setColumnMeta([])
      setTotalCount(0)
    }
  }, [tableName])

  // Fetch when deps change
  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  // Reset page to 1 when filters change
  const setFiltersAndResetPage = useCallback((newFilters: TableFilter[]) => {
    setFilters(newFilters)
    setPage(1)
  }, [])

  const setPageSizeAndReset = useCallback((size: number) => {
    setPageSize(size)
    setPage(1)
  }, [])

  const setSort = useCallback(
    (column: string | undefined, dir: "asc" | "desc" = "asc") => {
      setSortCol(column)
      setSortDir(dir)
    },
    []
  )

  const toggleSort = useCallback(
    (column: string) => {
      if (sort === column) {
        if (sortDir === "asc") {
          setSortDir("desc")
        } else {
          setSortCol(undefined)
          setSortDir("asc")
        }
      } else {
        setSortCol(column)
        setSortDir("asc")
      }
    },
    [sort, sortDir]
  )

  const addFilter = useCallback(
    (filter: TableFilter) => {
      setFiltersAndResetPage([...filters, filter])
    },
    [filters, setFiltersAndResetPage]
  )

  const removeFilter = useCallback(
    (index: number) => {
      setFiltersAndResetPage(filters.filter((_, i) => i !== index))
    },
    [filters, setFiltersAndResetPage]
  )

  const clearFilters = useCallback(() => {
    setFiltersAndResetPage([])
  }, [setFiltersAndResetPage])

  const toggleColumn = useCallback(
    (column: string) => {
      setVisibleColumns((prev) =>
        prev.includes(column)
          ? prev.filter((c) => c !== column)
          : [...prev, column]
      )
    },
    []
  )

  const toggleRowSelection = useCallback((rowKey: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowKey)) next.delete(rowKey)
      else next.add(rowKey)
      return next
    })
  }, [])

  const toggleAllOnPage = useCallback(() => {
    const allKeys = rows.map(getRowKey)
    const allSelected = allKeys.every((k) => selectedRows.has(k))
    if (allSelected) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(allKeys))
    }
  }, [rows, getRowKey, selectedRows])

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set())
  }, [])

  const insertRow = useCallback(
    async (data: Record<string, unknown>) => {
      if (!tableName) return
      await api.tables.insertRow(dbName, schema, tableName, data)
      await fetchRows()
    },
    [dbName, schema, tableName, fetchRows]
  )

  const updateRow = useCallback(
    async (
      pkValues: Record<string, unknown>,
      data: Record<string, unknown>
    ) => {
      if (!tableName) return
      await api.tables.updateRow(dbName, schema, tableName, pkValues, data)
      await fetchRows()
    },
    [dbName, schema, tableName, fetchRows]
  )

  const deleteSelectedRows = useCallback(
    async (pkValueSets: Record<string, unknown>[]) => {
      if (!tableName) return
      await api.tables.deleteRows(dbName, schema, tableName, pkValueSets)
      setSelectedRows(new Set())
      await fetchRows()
    },
    [dbName, schema, tableName, fetchRows]
  )

  return {
    rows,
    columns,
    columnMeta,
    totalCount,
    executionTime,
    loading,
    error,
    hasPrimaryKey,
    primaryKeys,
    page,
    pageSize,
    totalPages,
    setPage,
    setPageSize: setPageSizeAndReset,
    sort,
    sortDir,
    setSort,
    toggleSort,
    filters,
    setFilters: setFiltersAndResetPage,
    addFilter,
    removeFilter,
    clearFilters,
    visibleColumns,
    setVisibleColumns,
    toggleColumn,
    selectedRows,
    toggleRowSelection,
    toggleAllOnPage,
    clearSelection,
    insertRow,
    updateRow,
    deleteRows: deleteSelectedRows,
    refresh: fetchRows,
    getRowKey,
  }
}
