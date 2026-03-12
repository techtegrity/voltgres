"use client"

import { useState, useMemo, use } from "react"
import { useTables } from "@/hooks/use-tables"
import { useTableData } from "@/hooks/use-table-data"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table2,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Database,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"
import { TableDataGrid } from "@/components/tables/table-data-grid"
import { TableStructureView } from "@/components/tables/table-structure-view"
import { TableToolbar } from "@/components/tables/table-toolbar"
import { AddRecordDialog } from "@/components/tables/add-record-dialog"
import { EditRecordDialog } from "@/components/tables/edit-record-dialog"
import { DeleteConfirmDialog } from "@/components/tables/delete-confirm-dialog"

function formatNumber(num: number) {
  return new Intl.NumberFormat("en-US").format(num)
}

export default function DatabaseTablesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dbName = decodeURIComponent(id)
  const { tables, loading: tablesLoading } = useTables(dbName)

  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [selectedSchema, setSelectedSchema] = useState<string>("public")
  const [activeTab, setActiveTab] = useState<"content" | "structure">("content")

  // CRUD dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingRows, setDeletingRows] = useState<Record<string, unknown>[]>([])

  // Group tables by schema
  const schemaGroups = useMemo(() => {
    const groups: Record<string, typeof tables> = {}
    for (const table of tables) {
      const schema = table.schema || "public"
      if (!groups[schema]) groups[schema] = []
      groups[schema].push(table)
    }
    return groups
  }, [tables])

  const schemas = useMemo(() => Object.keys(schemaGroups).sort(), [schemaGroups])

  // Table data hook
  const tableData = useTableData(dbName, selectedSchema, selectedTable)

  // Handlers
  const handleSelectTable = (schema: string, name: string) => {
    if (selectedTable === name && selectedSchema === schema) {
      setSelectedTable(null)
    } else {
      setSelectedSchema(schema)
      setSelectedTable(name)
      setActiveTab("content")
    }
  }

  const handleEditRow = (row: Record<string, unknown>) => {
    setEditingRow(row)
    setEditDialogOpen(true)
  }

  const handleDeleteRow = (row: Record<string, unknown>) => {
    const pkValues: Record<string, unknown> = {}
    for (const pk of tableData.primaryKeys) {
      pkValues[pk] = row[pk]
    }
    setDeletingRows([pkValues])
    setDeleteDialogOpen(true)
  }

  const handleDeleteSelected = () => {
    const pkValueSets: Record<string, unknown>[] = []
    for (const row of tableData.rows) {
      const rowKey = tableData.getRowKey(row)
      if (tableData.selectedRows.has(rowKey)) {
        const pkValues: Record<string, unknown> = {}
        for (const pk of tableData.primaryKeys) {
          pkValues[pk] = row[pk]
        }
        pkValueSets.push(pkValues)
      }
    }
    setDeletingRows(pkValueSets)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    await tableData.deleteRows(deletingRows)
    setDeletingRows([])
  }

  const selectedTableMeta = tables.find(
    (t) => t.name === selectedTable && t.schema === selectedSchema
  )

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left sidebar — table list */}
        <div className="w-64 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
              <Database className="w-4 h-4 text-primary shrink-0" />
              {dbName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tables.length} {tables.length === 1 ? "table" : "tables"}
            </p>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            {tablesLoading ? (
              <div className="px-3 py-8 text-center text-muted-foreground text-xs">
                Loading tables...
              </div>
            ) : tables.length === 0 ? (
              <div className="px-3 py-8 text-center text-muted-foreground text-xs">
                No tables found
              </div>
            ) : (
              <div className="py-1">
                {schemas.map((schema) => (
                  <div key={schema}>
                    {schemas.length > 1 && (
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {schema}
                      </div>
                    )}
                    {schemaGroups[schema].map((table) => {
                      const isSelected =
                        selectedTable === table.name &&
                        selectedSchema === schema
                      return (
                        <button
                          key={`${schema}.${table.name}`}
                          onClick={() => handleSelectTable(schema, table.name)}
                          className={`w-full px-3 py-1.5 text-left hover:bg-muted/50 transition-colors flex items-center justify-between group ${
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Table2 className="w-3.5 h-3.5 shrink-0 opacity-60" />
                            <span className="font-mono text-xs truncate">
                              {table.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                            {formatNumber(table.row_count)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right panel — table content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedTable && selectedTableMeta ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <h1 className="font-mono text-base font-semibold truncate">
                      {selectedSchema !== "public" && (
                        <span className="text-muted-foreground">
                          {selectedSchema}.
                        </span>
                      )}
                      {selectedTable}
                    </h1>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>
                        {formatNumber(tableData.totalCount)} rows
                      </span>
                      <span>
                        {tableData.columnMeta.length} columns
                      </span>
                      {!tableData.hasPrimaryKey && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 text-amber-500">
                              <AlertTriangle className="w-3 h-3" />
                              No primary key
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit and delete are disabled for tables without a primary key</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as "content" | "structure")}
                    className="ml-4"
                  >
                    <TabsList className="h-8">
                      <TabsTrigger value="content" className="text-xs px-3 h-7">
                        Content
                      </TabsTrigger>
                      <TabsTrigger value="structure" className="text-xs px-3 h-7">
                        Structure
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Delete selected */}
                  {tableData.selectedRows.size > 0 && tableData.hasPrimaryKey && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={handleDeleteSelected}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete ({tableData.selectedRows.size})
                    </Button>
                  )}

                  {/* Refresh */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => tableData.refresh()}
                    disabled={tableData.loading}
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        tableData.loading ? "animate-spin" : ""
                      }`}
                    />
                  </Button>

                  {/* Add Record */}
                  <Button
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setAddDialogOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Record
                  </Button>
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {activeTab === "content" ? (
                  <>
                    {/* Toolbar */}
                    <div className="px-4 py-2 border-b border-border shrink-0">
                      <TableToolbar
                        columns={tableData.columns}
                        columnMeta={tableData.columnMeta}
                        visibleColumns={tableData.visibleColumns}
                        setVisibleColumns={tableData.setVisibleColumns}
                        toggleColumn={tableData.toggleColumn}
                        filters={tableData.filters}
                        addFilter={tableData.addFilter}
                        removeFilter={tableData.removeFilter}
                        clearFilters={tableData.clearFilters}
                        pageSize={tableData.pageSize}
                        setPageSize={tableData.setPageSize}
                        totalCount={tableData.totalCount}
                        executionTime={tableData.executionTime}
                      />
                    </div>

                    {/* Error banner */}
                    {tableData.error && (
                      <div className="mx-4 mt-2 px-3 py-2 text-sm text-destructive bg-destructive/10 rounded-md">
                        {tableData.error}
                      </div>
                    )}

                    {/* Data grid */}
                    <div className="flex-1 min-h-0 overflow-auto px-4 py-2">
                      <TableDataGrid
                        rows={tableData.rows}
                        visibleColumns={tableData.visibleColumns}
                        columnMeta={tableData.columnMeta}
                        sort={tableData.sort}
                        sortDir={tableData.sortDir}
                        toggleSort={tableData.toggleSort}
                        selectedRows={tableData.selectedRows}
                        toggleRowSelection={tableData.toggleRowSelection}
                        toggleAllOnPage={tableData.toggleAllOnPage}
                        getRowKey={tableData.getRowKey}
                        hasPrimaryKey={tableData.hasPrimaryKey}
                        primaryKeys={tableData.primaryKeys}
                        onEditRow={handleEditRow}
                        onDeleteRow={handleDeleteRow}
                        onUpdateCell={async (pkValues, column, value) => {
                          await tableData.updateRow(pkValues, { [column]: value })
                        }}
                        loading={tableData.loading}
                      />
                    </div>

                    {/* Pagination */}
                    {tableData.totalPages > 1 && (
                      <div className="px-4 py-2 border-t border-border flex items-center justify-between shrink-0">
                        <span className="text-xs text-muted-foreground">
                          Page {tableData.page} of {tableData.totalPages}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={tableData.page <= 1}
                            onClick={() => tableData.setPage(tableData.page - 1)}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>

                          {/* Page numbers */}
                          {generatePageNumbers(tableData.page, tableData.totalPages).map(
                            (p, i) =>
                              p === "..." ? (
                                <span
                                  key={`dots-${i}`}
                                  className="px-1 text-xs text-muted-foreground"
                                >
                                  ...
                                </span>
                              ) : (
                                <Button
                                  key={p}
                                  variant={p === tableData.page ? "default" : "outline"}
                                  size="icon"
                                  className="h-7 w-7 text-xs"
                                  onClick={() => tableData.setPage(p as number)}
                                >
                                  {p}
                                </Button>
                              )
                          )}

                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={tableData.page >= tableData.totalPages}
                            onClick={() => tableData.setPage(tableData.page + 1)}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Structure tab */
                  <div className="flex-1 min-h-0 overflow-auto p-4">
                    <TableStructureView columns={tableData.columnMeta} />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* No table selected */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Table2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                <h2 className="text-lg font-medium text-muted-foreground mb-1">
                  Select a table
                </h2>
                <p className="text-sm text-muted-foreground/70">
                  Choose a table from the sidebar to browse its data
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dialogs */}
        <AddRecordDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          columnMeta={tableData.columnMeta}
          onSubmit={tableData.insertRow}
        />

        <EditRecordDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          columnMeta={tableData.columnMeta}
          row={editingRow}
          primaryKeys={tableData.primaryKeys}
          onSubmit={tableData.updateRow}
        />

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          count={deletingRows.length}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </TooltipProvider>
  )
}

/** Generate page numbers with ellipsis for pagination */
function generatePageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | "...")[] = [1]

  if (current > 3) {
    pages.push("...")
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) {
    pages.push("...")
  }

  pages.push(total)

  return pages
}
