import { useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { COUNT_LIMIT, type GetAll, type ListOptions } from "@/lib/paging"
import { unwrap } from "@/lib/dataverse"

export interface PagedQuery {
  /** Columns to return. Always set. */
  select: string[]
  filter?: string
  /** End with the primary key so rows with equal sort values keep a stable order. */
  orderBy?: string[]
  /** Rows per page. Default 25. */
  pageSize?: number
}

/**
 * Server-side paging over a generated service's `getAll`.
 *
 * Dataverse pages with a cursor, not an offset: each page returns a `skipToken`
 * for the page after it, and there is no `$skip`. So "next" uses the token that
 * came back, and "previous" uses a stack of the tokens already seen.
 */
export function usePagedQuery<T>(key: string, getAll: GetAll<T>, query: PagedQuery) {
  const pageSize = query.pageSize ?? 25

  // tokens[i] is the skipToken that fetches page i; page 0 needs none.
  const [tokens, setTokens] = useState<(string | undefined)[]>([undefined])
  const [pageIndex, setPageIndex] = useState(0)

  // A new filter or sort is a new result set: start again at page 0. Done during
  // render (React's "adjust state when a prop changes" pattern), so no request is
  // ever sent for the old page index with the new filter.
  const signature = JSON.stringify([query.select, query.filter, query.orderBy, pageSize])
  const [prevSignature, setPrevSignature] = useState(signature)
  if (signature !== prevSignature) {
    setPrevSignature(signature)
    setTokens([undefined])
    setPageIndex(0)
  }

  const result = useQuery({
    queryKey: [key, signature, pageIndex],
    queryFn: async () => {
      const options: ListOptions = {
        select: query.select,
        filter: query.filter,
        orderBy: query.orderBy,
        // Never `top` here: it caps the whole result set and stops Dataverse
        // returning a skipToken. `maxPageSize` is what sets the page size.
        maxPageSize: pageSize,
        skipToken: tokens[pageIndex],
        count: true,
      }
      const page = await getAll(options)
      return { rows: unwrap(page, `Load ${key}`), skipToken: page.skipToken, count: page.count }
    },
    // Keep showing the current page while the next one loads.
    placeholderData: keepPreviousData,
  })

  const nextToken = result.data?.skipToken
  const count = result.data?.count

  function next() {
    if (!nextToken || result.isPlaceholderData) return
    setTokens((prev) => {
      const copy = [...prev]
      copy[pageIndex + 1] = nextToken
      return copy
    })
    setPageIndex((i) => i + 1)
  }

  function prev() {
    setPageIndex((i) => Math.max(0, i - 1))
  }

  return {
    rows: result.data?.rows ?? [],
    pageIndex,
    pageSize,
    hasNext: !!nextToken && !result.isPlaceholderData,
    hasPrev: pageIndex > 0,
    next,
    prev,
    /** Total matching rows. `undefined` until known; capped at 5,000 by Dataverse. */
    totalCount: count,
    /** True when the total is Dataverse's 5,000 cap, i.e. "5,000 or more". */
    countCapped: count !== undefined && count >= COUNT_LIMIT,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
  }
}
