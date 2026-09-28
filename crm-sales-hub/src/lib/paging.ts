import type { IOperationResult } from "@microsoft/power-apps/data"
import type { IGetAllOptions } from "@/generated/models/CommonModels"
import { unwrap } from "@/lib/dataverse"

/**
 * `getAll` options plus `count`, which SDK 1.4 sends as `$count=true`.
 * Services generated before 1.4 don't declare `count`, but they pass the
 * options object straight through to the client library, so it still works.
 */
export type ListOptions = IGetAllOptions & { count?: boolean }

/** Any generated service's `getAll`. */
export type GetAll<T> = (options: IGetAllOptions) => Promise<IOperationResult<T[]>>

/** Largest page Dataverse returns in one request. */
export const MAX_PAGE_SIZE = 5000

/** Dataverse stops counting at 5,000: `@odata.count` never reports more. */
export const COUNT_LIMIT = 5000

/**
 * Walks every `skipToken` page and returns all matching rows.
 *
 * A bare `getAll` returns only the first page (500 rows by default) and quietly
 * drops the rest. Use this for lists that must be complete: dashboard totals,
 * small reference tables filtered in the browser. It fails loudly past
 * `maxRows` instead of truncating, because a partial total looks like a real one.
 */
export async function fetchAllPages<T>(
  getAll: GetAll<T>,
  options: Omit<ListOptions, "top" | "skip" | "skipToken" | "maxPageSize">,
  label: string,
  maxRows = 50_000,
): Promise<T[]> {
  const rows: T[] = []
  let skipToken: string | undefined
  do {
    const result = await getAll({ ...options, maxPageSize: MAX_PAGE_SIZE, skipToken })
    rows.push(...unwrap(result, label))
    skipToken = result.skipToken
    if (skipToken && rows.length >= maxRows) {
      throw new Error(`${label}: more than ${maxRows.toLocaleString()} rows. Filter or aggregate on the server instead.`)
    }
  } while (skipToken)
  return rows
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** IDs per request. Keeps the `or` filter well inside URL length limits. */
const IDS_PER_REQUEST = 50

/**
 * Fetches the rows whose `idColumn` is one of `ids`: the stand-in for `$expand`,
 * which the Dataverse connector doesn't support. Instead of one query per row
 * (N+1), it sends one query per 50 distinct IDs, in parallel.
 */
export async function fetchByIds<T>(
  getAll: GetAll<T>,
  idColumn: string,
  ids: readonly (string | null | undefined)[],
  select: string[],
  label: string,
): Promise<T[]> {
  const unique = [...new Set(ids.filter((id): id is string => !!id && GUID.test(id)))]
  const batches: string[][] = []
  for (let i = 0; i < unique.length; i += IDS_PER_REQUEST) {
    batches.push(unique.slice(i, i + IDS_PER_REQUEST))
  }
  const pages = await Promise.all(
    batches.map((batch) =>
      fetchAllPages(getAll, { select, filter: batch.map((id) => `${idColumn} eq ${id}`).join(" or ") }, label),
    ),
  )
  return pages.flat()
}
