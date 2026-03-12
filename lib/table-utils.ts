import { type ColumnRow } from "@/lib/api-client"

/**
 * Map a column's PG type to an HTML input type for editing.
 */
export function getInputType(col: ColumnRow): string {
  const t = col.udt_type || col.type
  if (
    [
      "int2",
      "int4",
      "int8",
      "float4",
      "float8",
      "numeric",
      "decimal",
      "integer",
      "bigint",
      "smallint",
      "real",
      "double precision",
    ].includes(t)
  )
    return "number"
  if (["bool", "boolean"].includes(t)) return "boolean"
  if (["timestamp", "timestamptz"].includes(t)) return "datetime-local"
  if (["date"].includes(t)) return "date"
  if (["time", "timetz"].includes(t)) return "time"
  if (["json", "jsonb"].includes(t)) return "textarea"
  return "text"
}

/**
 * Convert a raw string editor value to the typed value for the column.
 * Returns null, number, boolean, parsed JSON, or string.
 */
export function convertValue(
  raw: string,
  col: ColumnRow,
  isNull: boolean
): unknown {
  if (isNull) return null

  const inputType = getInputType(col)

  if (inputType === "number") {
    return raw === "" ? null : Number(raw)
  }
  if (inputType === "boolean") {
    return raw === "true"
  }
  if (inputType === "textarea") {
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw || null
}

/**
 * Convert a value from the database into a string for editing.
 */
export function valueToString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}

/**
 * Detect auto-generated columns (serial, uuid, timestamps).
 */
export function isAutoColumn(col: ColumnRow): boolean {
  const def = col.default_value || ""
  return (
    def.startsWith("nextval(") ||
    def.startsWith("gen_random_uuid()") ||
    def === "now()" ||
    def === "CURRENT_TIMESTAMP"
  )
}
