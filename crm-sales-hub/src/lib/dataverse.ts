import type { IOperationResult } from "@microsoft/power-apps/data"

/**
 * Generated services do not throw when a request fails. They resolve with
 * `{ success: false, error }`, so `result.data ?? []` quietly turns a failed
 * query into an empty list and TanStack Query never reports `isError`.
 * Wrap every service call in this so failures surface as errors.
 */
export function unwrap<T>(result: IOperationResult<T>, label: string): T {
  if (!result.success) throw result.error ?? new Error(`${label} failed`)
  return result.data
}

const FORMATTED_VALUE = "@OData.Community.Display.V1.FormattedValue"

/**
 * The display label Dataverse sends alongside a choice, lookup, date or money
 * column, e.g. "Hot" for `opportunityratingcode` = 1. Select the base column
 * (or the `_x_value` column for a lookup) and read its label from here. The
 * generated `...name` properties are not populated on reads.
 */
export function formattedValue(row: object, column: string): string | undefined {
  const value = (row as Record<string, unknown>)[column + FORMATTED_VALUE]
  return typeof value === "string" ? value : undefined
}

/**
 * Quote a value as an OData string literal. A single quote inside the value
 * must be doubled, otherwise a search like "O'Brien" breaks the filter.
 */
export function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}
