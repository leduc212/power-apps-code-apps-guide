# Chapter 7: Data at Scale

> **Blog post title:** Paging, Counting and Joining Dataverse Data in Power Apps Code Apps
>
> **Audience:** You've finished Part 1. Your app works on a trial environment with a few hundred rows. This chapter is about what happens when a table has fifty thousand.
>
> **Part 2** is based on a production Code App we implemented to replace a large Canvas App. The patterns are real; the code is rewritten against this repo's demo tables.

---

## Introduction

Everything in Part 1 works on a demo environment. Most of it quietly stops working on a real one.

The quiet part is the problem. When our production app first met real data volumes, nothing crashed. Instead:

- A list showed the first 500 rows and no sign that more existed.
- A dashboard total was correct in Dev and wrong in Production, with nothing to say so.
- A pager lost its page numbers on one tab but not on an identical tab next to it. The only difference was that one tab had crossed 5,000 rows.
- A detail screen made one request per row to look up related data, and got slower with every row.

Each of these comes from how Dataverse pages, counts and joins. This chapter covers the rules, and four patterns built on them:

1. **Page-by-page lists** with a real total (`usePagedQuery`)
2. **Counting** past Dataverse's 5,000 cap
3. **Fetching everything** for totals and small lists (`fetchAllPages`)
4. **Joining without `$expand`** (formatted values and `fetchByIds`)

All of it is in the demo: the Accounts page pages properly now, and the dashboard computes from complete data and shows a "Top Open Deals" table with related account details.

---

## How Dataverse Pages

Dataverse doesn't page by offset ("skip 50, take 25"). It pages with a **cursor**:

```
getAll({ maxPageSize: 25 })
  → rows 1-25   + skipToken A
getAll({ maxPageSize: 25, skipToken: A })
  → rows 26-50  + skipToken B
getAll({ maxPageSize: 25, skipToken: B })
  → rows 51-62  (no skipToken: this is the last page)
```

The rules that follow from this, confirmed in the client library's source:

| Rule | Consequence |
|---|---|
| Page size comes from `maxPageSize`, **default 500**, maximum 5,000 | A bare `getAll()` returns at most 500 rows |
| More rows exist when `result.skipToken` is set | Ignore it and the rest is silently dropped |
| There is **no `$skip`** in the Dataverse Web API | `skip` is in `IGetAllOptions`, but you can't use it against Dataverse. You can't jump straight to page 40. |
| **`top` caps the whole result set and suppresses the `skipToken`** | Never combine `top` with paging. `top` is for "the first N and nothing more". |
| `count: true` (SDK 1.4+) returns the total, **capped at 5,000** | Past 5,000 you get 5,000 |

The `top` rule is the easiest to break. `top: 25` looks like "a page of 25", and it returns 25 rows, but it never returns a `skipToken`, so there is no page 2. Use `maxPageSize` for page size.

---

## Pattern 1: A Paged List

The Accounts page now shows 25 accounts at a time with Previous/Next and a total. The hook:

```typescript
// src/hooks/usePagedQuery.ts (abridged)
export function usePagedQuery<T>(key: string, getAll: GetAll<T>, query: PagedQuery) {
  const pageSize = query.pageSize ?? 25

  // tokens[i] is the skipToken that fetches page i; page 0 needs none.
  const [tokens, setTokens] = useState<(string | undefined)[]>([undefined])
  const [pageIndex, setPageIndex] = useState(0)

  // A new filter or sort is a new result set: start again at page 0.
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
        maxPageSize: pageSize,         // never `top`
        skipToken: tokens[pageIndex],
        count: true,
      }
      const page = await getAll(options)
      return { rows: unwrap(page, `Load ${key}`), skipToken: page.skipToken, count: page.count }
    },
    placeholderData: keepPreviousData,
  })

  function next() {
    const nextToken = result.data?.skipToken
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
  // ...returns rows, next, prev, hasNext, hasPrev, totalCount, countCapped, isLoading, error
}
```

And the page:

```tsx
const page = usePagedQuery("accounts", AccountsService.getAll, {
  select: ["name", "accountnumber", "address1_city", "telephone1", "statecode"],
  filter: debouncedSearch ? `contains(name, ${odataString(debouncedSearch)})` : undefined,
  orderBy: ["name asc", "accountid asc"],
  pageSize: 25,
})
```

The decisions behind it:

**A stack of tokens for "Previous".** A `skipToken` only moves forward. To go back, remember the token for every page you've visited. `tokens[3]` is how you get page 3 again. Pages you've visited are also in TanStack Query's cache, so going back is instant.

**Reset to page 0 when the filter changes, during render.** A new search is a new result set, and the old tokens belong to the old one. Resetting in a `useEffect` would work, but it runs *after* the render. For one render the query would run with the new filter and the old page index, and send a pointless request. Adjusting state during render (the pattern React documents for "adjusting state when a prop changes") applies the reset before the query runs.

**`keepPreviousData`.** While page 3 loads, page 2 stays on screen instead of flashing to a skeleton. `isPlaceholderData` is true during that time, so `next()` ignores clicks until the new page arrives.

**End the sort with the primary key.** `orderBy: ["name asc", "accountid asc"]`. Two accounts called "Contoso" can otherwise come back in either order, and a row can appear on two pages or on none. A unique last sort column makes the order, and so the pages, stable.

**Pass the service method directly.** `AccountsService.getAll` can be passed unbound because the generated services refer to their client by class name, not through `this`.

### Using `count` on an older generator

SDK 1.4 added `count` to the client library, but services generated before 1.4 don't declare it in `IGetAllOptions`. They pass the options object straight through, though, so it works at runtime. The demo widens the type once instead of casting at every call:

```typescript
// src/lib/paging.ts
export type ListOptions = IGetAllOptions & { count?: boolean }
```

After regenerating with a current CLI (`pa app refresh data-source`) you may not need this.

---

## Pattern 2: Counting Past 5,000

`count: true` is cheap and accurate up to 5,000. After that, `@odata.count` says 5,000. The demo is honest about it: `countCapped` is true at the cap and the pager shows "1-25 of 5,000+ accounts".

For many lists that's enough. If your users genuinely need "of 48,213", count it yourself: walk the pages selecting **only the primary key**, with the largest page size, and add up the lengths.

```typescript
async function countAll(getAll: GetAll<{ accountid: string }>, filter?: string, maxPages = 20) {
  let total = 0
  let skipToken: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const result = await getAll({ select: ["accountid"], filter, maxPageSize: 5000, skipToken })
    total += unwrap(result, "Count accounts").length
    if (!result.skipToken) return total
    skipToken = result.skipToken
  }
  return undefined // more rows than we are willing to count
}
```

This is how our production app counted before the client library could. Keep three things from it:

- **Select only the ID.** Each page carries 5,000 rows; make them as small as possible.
- **Cap the walk.** Twenty pages is 100,000 rows. Past that, show "100,000+" rather than a slow query nobody asked for.
- **Run it as its own query, keyed by the filter, not the page.** The total changes when the filter changes, not when the user clicks Next. Cache it with a `staleTime` and render the rows without waiting for it.

This is the bug from the introduction, where one tab lost its page numbers. The first version counted by fetching a single 5,000-row page, and treated "there's a `skipToken`" as "unknown". The tab with more than 5,000 rows had no total and no page numbers. The tab next to it, with the same code, looked fine.

### Jumping to page N

Users like clicking a page number, and a cursor can't jump. To reach page 40 from page 1, you have to walk the tokens in between. Walking one 25-row page at a time is 39 requests.

The trick our production app used: **a `skipToken` means "continue after the last row I returned", whatever the page size.** So walk in big steps. Ask for 5,000 ID-only rows at a time and you move 200 pages per request. Page 400 costs 2 requests instead of 399. Record the token at each step, which must land on a page boundary (5,000 is a whole number of 25-row pages), and stop early if a step comes back short, because the data ended.

This doesn't need to be in every app. If your lists are long and users jump around, it's the difference between a page-number bar that works and one that doesn't.

---

## Pattern 3: Fetch Everything (Carefully)

Some screens need every matching row: a dashboard total, a small reference list you filter in the browser, an export. For those, walk the pages to the end:

```typescript
// src/lib/paging.ts
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
```

The dashboard from Chapter 5 now uses it instead of `top: 500`:

```typescript
const { data: opportunities = [] } = useQuery({
  queryKey: ["dashboard-opportunities"],
  queryFn: () =>
    fetchAllPages(
      OpportunitiesService.getAll,
      { select: ["opportunityid", "name", "statecode", "estimatedvalue", "opportunityratingcode", "salesstage", "_parentaccountid_value"] },
      "Load opportunities",
    ),
})
```

Two design choices matter:

**5,000 rows per request.** Fewer round trips. 12,000 opportunities is 3 requests, not 24.

**Fail loudly at the limit.** Our production helper stopped quietly after a fixed number of pages. That's safer than looping forever, but it recreates the original bug: a partial list that looks complete. This version throws instead, and the dashboard's error state says why. If you hit it, the answer isn't a bigger limit. Filter on the server, or aggregate there (a Dataverse custom API added with `pa app add dataverse-api`, or a Power Automate flow).

Don't use `fetchAllPages` for lists a person scrolls through. That's Pattern 1, or for pickers, the next section.

### Pickers: load more as you scroll

For a search-as-you-type picker (choose a customer, choose a product), neither pattern fits. You don't want page buttons in a dropdown, and you don't want 20,000 rows up front. Use TanStack Query's `useInfiniteQuery`, with the `skipToken` as the page parameter:

```typescript
const results = useInfiniteQuery({
  queryKey: ["account-picker", search],
  initialPageParam: undefined as string | undefined,
  queryFn: async ({ pageParam }) => {
    const page = await AccountsService.getAll({
      select: ["accountid", "name"],
      filter: search ? `contains(name, ${odataString(search)})` : undefined,
      orderBy: ["name asc", "accountid asc"],
      maxPageSize: 50,          // again: not `top`
      skipToken: pageParam,
    })
    return { rows: unwrap(page, "Search accounts"), skipToken: page.skipToken }
  },
  getNextPageParam: (last) => last.skipToken,
})

const rows = results.data?.pages.flatMap((p) => p.rows) ?? []
// call results.fetchNextPage() when the list is scrolled near the bottom
```

Our production pickers originally used `maxPageSize: 50` and nothing else. There was simply no way to reach row 51. Nobody noticed until a user couldn't find a customer that plainly existed.

---

## Pattern 4: Joins Without `$expand`

The Dataverse connector for Code Apps doesn't support `$expand`, so "opportunities with their account's city" can't be one query. There are three ways to get related data. Use them in this order.

### 1. The label is already there

If you only need the related record's **name**, you don't need another query. Select the lookup's `_value` column and read its formatted value (Chapter 3):

```tsx
select: ["name", "estimatedvalue", "_parentaccountid_value"]

formattedValue(opportunity, "_parentaccountid_value")   // "Contoso Ltd"
```

This covers more cases than you'd expect: most grids only show the related record's name.

### 2. One batched query for all related rows

If you need other columns of the related record, fetch those records **by ID, in one go**. The dashboard's "Top Open Deals" table shows the five biggest open opportunities with their account name (pattern 1) and city (this pattern):

```typescript
// src/lib/paging.ts
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
```

```tsx
// src/pages/dashboard-top-deals.tsx
const accountIds = top.map((o) => o._parentaccountid_value)

const { data: cityById } = useQuery({
  queryKey: ["top-deal-accounts", accountIds],
  enabled: accountIds.some(Boolean),
  queryFn: async () => {
    const accounts = await fetchByIds(AccountsService.getAll, "accountid", accountIds, ["accountid", "address1_city"], "Load accounts")
    return new Map(accounts.map((a) => [a.accountid, a.address1_city]))
  },
})
```

Then look each row up in the map. The details:

- **De-duplicate first.** Ten opportunities on three accounts is three IDs, not ten.
- **Batch the IDs**, 50 per request, so the `or` filter stays well inside URL length limits. Batches run in parallel.
- **Only accept real GUIDs.** The IDs come from Dataverse, but they end up inside a filter string. A GUID check costs nothing and means nothing else can get in.
- **Key the query on the IDs.** When the parent rows change, the lookup refetches; when they don't, it's cached.

### 3. The anti-pattern: one query per row

```typescript
// ❌ N+1: one request per row, and slower with every row
for (const o of opportunities) {
  const account = await AccountsService.get(o._parentaccountid_value!)
}
```

This is the natural translation of a Canvas `LookUp()` inside a gallery, and it's the most common performance problem when porting Canvas logic. Twenty-five rows is twenty-five requests. Rewrite it as pattern 1 or 2.

---

## Filter on the Server, Not in the Browser

One rule ties this together: **let Dataverse do the filtering, sorting and paging.** `filter`, `orderBy`, `maxPageSize` and `skipToken` all run on the server. A filter in JavaScript only sees the rows you've downloaded, so it's only correct on a complete list, which means `fetchAllPages`, which means a small table.

A list that loads 500 rows and then filters them in the browser has the same bug as `top: 500`: it's right until the table grows, and then it's wrong without looking wrong.

---

## Key Takeaways

- Dataverse pages with a cursor: `maxPageSize` (default **500**, max 5,000) plus `skipToken`. There's no `$skip`
- **`top` suppresses the `skipToken`.** Use it only for "first N"; use `maxPageSize` for pages
- Keep a stack of tokens for Previous; reset to page 0 when the filter changes; end `orderBy` with the primary key
- `count: true` (SDK 1.4) gives totals up to 5,000; show "5,000+" at the cap, or count ID-only pages yourself
- Jump to page N by walking the cursor in 5,000-row, ID-only steps, not page by page
- `fetchAllPages` for totals and small lists, and make it fail loudly, never truncate silently
- Pickers: `useInfiniteQuery` with the `skipToken` as the page parameter
- Related data: formatted values first, then one batched `fetchByIds` query, never one query per row
- Filter on the server; a browser-side filter is only correct on a complete list

---

## What's Next

Chapter 8 covers the other half of a real app's data: calling Power Automate flows and other connectors from code, and building a UI for work that takes longer than a request.

---

*Previous: Chapter 6 - Context, ALM & Production Readiness*
*Next: Chapter 8 - Flows and Connectors*
