# Chapter 3: Connecting to Dataverse

> **Blog post title:** Dataverse from TypeScript: How Power Apps Code Apps Generates Your Data Layer
>
> **Audience:** Following along from Chapter 2. You have a Code App running locally and published. Now we connect it to real CRM data.
>
> **Updated September 2026** for SDK 1.4 and the Power Apps CLI (`pa`). This chapter changed the most: the February version swallowed errors and had option-set labels backwards. The original is at the [`v1-feb-2026`](https://github.com/leduc212/power-apps-code-apps-guide/tree/v1-feb-2026) tag.

---

## Introduction

Chapter 2 gave us a working shell. Now the part that matters for a CRM developer: Dataverse.

This chapter covers what the CLI generates when you add a table, what the generated services actually return (which is not what I assumed in February), and how to build an Accounts list with search on top of them.

---

## How Dataverse Integration Works

In a Canvas App you add a data source in the designer and Power Fx handles the queries. In a Model-Driven App you configure views and forms and the platform fetches data for you.

In Code Apps you tell the CLI which tables you need, and it **generates typed TypeScript files** for each one. Your React components import those files like any other module. Generation happens once per table; after that, components call service methods and get typed data back.

---

## Step 1: Add the Tables

From the project root:

```bash
pa app add data-source --connector dataverse --table account
pa app add data-source --connector dataverse --table contact
pa app add data-source --connector dataverse --table opportunity
```

`--table` takes the table's **logical name**: lowercase and singular (`account`, not `accounts`). For custom tables the logical name can be singular even when the entity set name everyone uses is plural; if the CLI says it can't find the table, check the logical name in the table's properties.

Run `pa app init` (Chapter 2) first, so the CLI already knows the environment. If it prompts for an **organization URL**, include the scheme: `https://yourorg.crm.dynamics.com`. Without `https://` the sign-in fails with an `AADSTS70011` invalid-scope error, because the CLI builds the token scope from exactly what you typed.

---

## Step 2: Understand What Got Generated

```
src/generated/
├── models/
│   ├── AccountsModel.ts
│   ├── ContactsModel.ts
│   ├── OpportunitiesModel.ts
│   └── CommonModels.ts        <- shared option types (IGetAllOptions, ...)
└── services/
    ├── AccountsService.ts
    ├── ContactsService.ts
    └── OpportunitiesService.ts
.power/schemas/                <- the table schemas the files were generated from
```

**Never edit anything in `src/generated/` or `.power/`.** When a table's columns change, regenerate:

```bash
pa app refresh data-source --name accounts   # or omit --name to refresh everything
```

> In February there was no refresh command; you had to delete and re-add the data source. That's fixed.

Because these files come from *your* environment's schema, they include any custom columns your organization added. Keep that in mind before you commit generated files from a client's environment to a public repo.

### The Model File

`AccountsModel.ts` is a TypeScript interface generated from the table's columns:

```typescript
export interface Accounts {
  accountid: string;
  accountnumber?: string;
  address1_city?: string;
  name: string;
  revenue?: string;         // money column, typed as a string
  statecode: string;        // choice column, typed as a string
  telephone1?: string;
  statecodename?: string;   // see "Display labels" below
  // ... many more fields
}
```

Two things about the generated types need care.

**Numbers and choice values.** When I built this app on the February generator, choice columns like `statecode` and money columns like `revenue` were typed as strings but arrived from Dataverse as numbers. So `account.statecode === "0"` compiled and was always false. The safe habit, whatever your generator version does, is to coerce before comparing or sending: `Number(account.statecode) === 0`. It's correct whether the value arrives as a string or a number.

**Display labels.** Dataverse returns a readable label next to every choice, lookup, date and money value, as an OData annotation on the same row:

```
"statecode": 0,
"statecode@OData.Community.Display.V1.FormattedValue": "Active"
```

The generated model also declares convenience properties like `statecodename`, but **they are not populated** on reads. Don't rely on them, and don't put them in `select`: they aren't columns, and asking for one fails with a 400 (*"Could not find a property named 'statecodename'"*). Select the base column and read the annotation. The demo has a small helper for that:

```typescript
// src/lib/dataverse.ts
const FORMATTED_VALUE = "@OData.Community.Display.V1.FormattedValue"

export function formattedValue(row: object, column: string): string | undefined {
  const value = (row as Record<string, unknown>)[column + FORMATTED_VALUE]
  return typeof value === "string" ? value : undefined
}
```

For a lookup, select its `_<name>_value` column (for example `_createdby_value`) and `formattedValue(row, "_createdby_value")` gives you the related record's name. No second query needed.

> **Correction from February:** I previously told you to map choice values to labels by hand and that `statecodename` "is returned automatically". The second part was wrong, and the first is unnecessary.

### The Service File

`AccountsService.ts` exposes the methods you call:

```typescript
AccountsService.getAll(options?)     // retrieve multiple records
AccountsService.get(id, options?)    // retrieve one record by primary key
AccountsService.create(record)       // create a record
AccountsService.update(id, changes)  // update only the fields you pass
AccountsService.delete(id)           // delete a record
```

### What the Services Return (read this one twice)

`get`, `getAll`, `create` and `update` resolve to an `IOperationResult`:

```typescript
interface IOperationResult<T> {
  success: boolean
  data: T
  error?: Error
  skipToken?: string   // there are more pages
  count?: number       // only when you ask for it (Chapter 7)
}
```

The important part: **when a request fails, the service does not throw.** It resolves with `success: false` and an `error`. Every February example in this series did this:

```typescript
const result = await AccountsService.getAll({ ... })
return result.data ?? []     // ❌ a failed query becomes an empty list
```

A failed query then looks exactly like "no records". TanStack Query never sees an error, `isError` stays false, and you spend an afternoon wondering why the table is empty. The fix is one helper that turns `success: false` into a thrown error:

```typescript
// src/lib/dataverse.ts
import type { IOperationResult } from "@microsoft/power-apps/data"

export function unwrap<T>(result: IOperationResult<T>, label: string): T {
  if (!result.success) throw result.error ?? new Error(`${label} failed`)
  return result.data
}
```

Every service call in the demo goes through it.

(Some problems still throw, such as a data source that was never added. TanStack Query catches those anyway. It's the resolved `success: false` case that gets lost.)

### `getAll` Options

```typescript
AccountsService.getAll({
  select: ["name", "accountnumber", "address1_city"],  // columns to return (always set this)
  filter: "statecode eq 0",                            // OData filter
  orderBy: ["name asc"],                               // sort
  top: 50,                                             // at most this many rows
})
```

`filter`, `orderBy` and `top` are sent to Dataverse (delegated), so the server does the work. The filter is a standard OData v4 expression, the same syntax as the Dataverse Web API:

```
statecode eq 0                              equality
contains(name, 'Contoso')                   string contains
startswith(name, 'A')                       string starts with
revenue gt 100000                           numeric comparison
statecode eq 0 and address1_country eq 'AU' logical and
```

**Always use `select`.** Fetching every column of a Dataverse row is slow and wasteful.

**`getAll` returns one page.** Without `top`, you get the first page of results (up to 5,000 rows), and if there are more, `result.skipToken` is set and the rest is silently left behind. For a search box showing 50 rows that's fine. For anything that must be complete, or anything with paging, see Chapter 7.

**What the Dataverse connector doesn't support** (per the docs, as of August 2026): FetchXML, alternate keys, polymorphic lookups, and creating or changing table definitions. There's also no `$expand`, so related data comes from separate queries (Chapter 4) or from display-label annotations.

---

## Step 3: Build the Accounts Page

```tsx
// src/pages/accounts.tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AccountsService } from "@/generated/services/AccountsService"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { odataString, unwrap } from "@/lib/dataverse"
// ...shadcn/ui imports

export default function AccountsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search.trim())

  const { data: accounts = [], isLoading, isError } = useQuery({
    queryKey: ["accounts", debouncedSearch],
    queryFn: async () => {
      const result = await AccountsService.getAll({
        select: ["name", "accountnumber", "address1_city", "telephone1", "statecode"],
        filter: debouncedSearch ? `contains(name, ${odataString(debouncedSearch)})` : undefined,
        orderBy: ["name asc"],
        top: 50,
      })
      return unwrap(result, "Load accounts")
    },
  })

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Accounts</h1>

      <Input
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isError && (
        <p className="text-sm text-destructive">Failed to load accounts. Check your Dataverse connection.</p>
      )}

      <Table>
        {/* header: Name, Account Number, City, Phone, Status */}
        <TableBody>
          {isLoading ? (
            /* skeleton rows */
          ) : (
            accounts.map((account) => (
              <TableRow key={account.accountid} onClick={() => navigate(`/accounts/${account.accountid}`)}>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell>{account.accountnumber ?? "-"}</TableCell>
                <TableCell>{account.address1_city ?? "-"}</TableCell>
                <TableCell>{account.telephone1 ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={Number(account.statecode) === 0 ? "default" : "secondary"}>
                    {Number(account.statecode) === 0 ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

The full file is in [`crm-sales-hub/src/pages/accounts.tsx`](../crm-sales-hub/src/pages/accounts.tsx). The parts worth explaining:

**`unwrap(result, "Load accounts")`** turns a failed request into an error, so the `isError` message actually appears. Without it, that message is dead code.

**`odataString(debouncedSearch)`** quotes user input safely. OData string literals use single quotes, so a search for *O'Brien* produces `contains(name, 'O'Brien')`: a broken filter and a 400. The helper doubles embedded quotes:

```typescript
export function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}
```

Any time user input goes into a filter, pass it through this.

**`useDebouncedValue` for the search box.** The query key uses the debounced value, so a request fires only after the user stops typing for 300 ms:

```typescript
// src/hooks/useDebouncedValue.ts
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
```

> **Correction from February:** I used React's `useDeferredValue` and called it a debounce. It isn't one. It defers *rendering*, not *requests*: typing still produces a new query key, and a Dataverse call, for almost every keystroke. Use a real debounce for anything that hits the network.

**`queryKey: ["accounts", debouncedSearch]`**: TanStack Query caches per key. Search for "Contoso", navigate away, come back, and the cached result shows instantly while a background refresh runs.

**`Number(account.statecode) === 0`**: the coercion habit from above. For a two-state column like this, a hard-coded "Active"/"Inactive" is fine. For anything with more options, use `formattedValue(account, "statecode")`.

---

## Step 4: Wire Up the Route and Navigation

Add the page to the router:

```tsx
// src/router.tsx
import AccountsPage from "@/pages/accounts"

// inside the "/" route's children:
{ path: "accounts", element: <AccountsPage /> },
```

Leave the template's `BASENAME` code at the top of `router.tsx` alone. The app is served from a generated path inside the Power Apps player, and that code keeps routes working there.

Then add a nav link in `src/pages/_layout.tsx`:

```tsx
<NavLink to="/accounts"
  className={({ isActive }) =>
    `text-sm text-muted-foreground hover:text-foreground ${isActive ? "text-foreground font-medium" : ""}`
  }
>
  Accounts
</NavLink>
```

---

## Step 5: Run and Verify

```bash
npm run dev
```

Open the Local Play URL and go to **Accounts**. You should see:

1. A loading skeleton while the query runs
2. Your real Account records
3. Search filtering on the server through a `contains` query, one request per pause in typing (watch the Network tab)
4. A red error message, not an empty table, if something goes wrong. Temporarily misspell a column in `select` to see it.

---

## What Is Actually Happening at Runtime

```
Your component
  -> AccountsService.getAll()     (generated service)
     -> @microsoft/power-apps     (client library)
        -> Power Apps host        (connector proxy)
           -> Dataverse connector
              -> Your Dynamics 365 environment
```

You never call the Dataverse Web API directly. The host signs the request with the user's session, applies DLP policies, and passes it on. That's why there's no auth code, no API keys and no CORS configuration in the project.

---

## Key Takeaways

- `pa app add data-source --connector dataverse --table <logical-name>` generates typed models and services in `src/generated/`; `pa app refresh data-source` regenerates them after a schema change
- Never edit `src/generated/`, and remember it reflects your environment's schema, custom columns included
- **Services resolve with `success: false` instead of throwing.** Wrap every call in `unwrap()` or your error states never show
- Read labels from the `@OData.Community.Display.V1.FormattedValue` annotation; the generated `...name` properties are empty and can't be selected
- Coerce with `Number()` before comparing or sending numeric and choice values
- Always `select`; escape user input in filters; `getAll` returns a single page
- Debounce search input; `useDeferredValue` is not a debounce

---

## What's Next

In Chapter 4 we go deeper into CRUD: an Account detail page with related Contacts and Opportunities, and creating and deleting Opportunities. That's where lookups, write payloads and the generated types get interesting.

---

*Previous: Chapter 2 - Hello World & Tooling*
*Next: Chapter 4 - Full CRUD for CRM Records*
