# Chapter 3: Connecting to Dataverse

> **Blog post title:** Dataverse from TypeScript: How Power Apps Code Apps Generates Your Data Layer
>
> **Audience:** Following along from Chapter 2. You have a Code App running locally and pushed to Power Platform. Now we connect it to real CRM data.

---

## Introduction

In Chapter 2 we got a working shell - a React TypeScript app running locally, pushed to Power Platform, showing a placeholder screen. That is the foundation. Now we do the part that matters for a CRM developer: connect it to Dataverse.

This chapter covers how Power Apps Code Apps handles Dataverse integration, what gets generated when you add a data source, and how to use those generated files to build a real Accounts list page with search.

By the end, the app will have a working Accounts screen that reads live data from your Dynamics 365 environment.

---

## How Dataverse Integration Works

Before running any commands, the mental model is worth understanding.

When you work with Dataverse in Canvas App, you add a data source through the UI and Power Fx handles the query syntax. In Model-Driven App, you configure views and forms and the platform fetches data for you.

In Code Apps, the approach is different: you tell the CLI which Dataverse tables you want to work with, and the SDK **generates typed TypeScript files** for those tables. You then import and use those generated files directly in your React components, like any other TypeScript module.

The generation happens once per table. After that, your components just call service methods and get back strongly-typed data.

---

## Step 1: Add Dataverse as a Data Source

Adding data sources still uses the PAC CLI (`pac code add-data-source`). This command is not yet part of the npm CLI.

Make sure you are authenticated first. If you used `npx power-apps init` in Chapter 2 you should already be authenticated. If not:

```bash
pac auth create
pac env select --environment fd2bdf27-ebda-e330-b5a3-06355e252f90
```

Now add the three tables the CRM Sales Hub needs:

```bash
pac code add-data-source -a dataverse -t account
pac code add-data-source -a dataverse -t opportunity
pac code add-data-source -a dataverse -t contact
```

The `-a dataverse` flag specifies the connector type. The `-t` flag is the **logical name** of the Dataverse table (lowercase, no spaces - same as what you see in the Dataverse table editor or the Web API).

Run each command from inside the `crm-sales-hub` folder.

---

## Step 2: Understand What Got Generated

After running those three commands, a new folder appears in `src`:

```
src/
├── generated/
│   ├── models/
│   │   ├── AccountsModel.ts
│   │   ├── OpportunitiesModel.ts
│   │   └── ContactsModel.ts
│   └── services/
│       ├── AccountsService.ts
│       ├── OpportunitiesService.ts
│       └── ContactsService.ts
└── ...
```

**Do not edit files in `src/generated/`**. They are regenerated every time you add or remove a data source and any manual changes will be overwritten.

### The Model File

Open `AccountsModel.ts`. It is a TypeScript interface generated directly from the Dataverse table schema:

```typescript
export interface Accounts {
  accountid: string;
  name: string;
  accountnumber: string | null;
  address1_city: string | null;
  address1_country: string | null;
  telephone1: string | null;
  statecode: string;           // "0" = Active, "1" = Inactive (string, not number)
  statecodename?: string;      // display label — returned as an annotation, do NOT put in select
  revenue: number | null;
  numberofemployees: number | null;
  // ... many more fields
}
```

This is a direct reflection of your Dataverse table columns with TypeScript types. Nullable columns are typed as `T | null`. Read-only system columns like `ownerid` and `createdon` are included.

**Gotcha — option set types do not match runtime values:** Fields like `statecode` are typed as `string` in the generated model, but the SDK actually returns them as `number` at runtime. This creates a lose-lose situation: comparing `statecode === 0` gives a TypeScript compile error (*"types 'string' and 'number' have no overlap"*), but comparing `statecode === "0"` compiles cleanly yet always evaluates to `false` at runtime because the value is actually `0`, not `"0"`.

The safe fix is to coerce with `Number()` before comparing — `Number(account.statecode) === 0`. This satisfies TypeScript and works regardless of whether the value comes back as a string or a number.

The SDK generates a companion `*name` field for every option set (e.g., `statecodename`) that appears in the model as optional. However, **do not include these `*name` fields in your `select` array** — they are not real Dataverse columns. They are formatted value annotations that Dataverse attaches to the response alongside the base field, and requesting them explicitly will result in a 400 error: *"Could not find a property named 'statecodename'."* Map option set values to labels manually in your component instead.

The model tells you exactly what data is available and TypeScript will warn you if you try to access a field that does not exist on the table.

### The Service File

Open `AccountsService.ts`. It exposes the methods you use to query and mutate data:

```typescript
AccountsService.getAll(options?)   // retrieve multiple records
AccountsService.get(id)            // retrieve one record by primary key
AccountsService.create(record)     // create a new record
AccountsService.update(id, changes) // update specific fields on a record
AccountsService.delete(id)         // delete a record
```

Each method returns a Promise that resolves to `{ data: T }` (or `{ data: T[] }` for `getAll`). The SDK handles the actual HTTP call to the Dataverse Web API through the Power Apps host connector proxy.

### `getAll` Options

The `getAll` method accepts an options object for querying:

```typescript
AccountsService.getAll({
  select: ["name", "accountnumber", "address1_city"],  // columns to return (always use this)
  filter: "statecode eq 0",                            // OData filter
  orderBy: ["name asc"],                               // sort
  top: 50,                                             // limit records
  skip: 0,                                             // offset (for paging)
})
```

The `filter` string is a standard OData v4 filter expression - the same syntax you use in the Dataverse Web API. Common patterns:

```
statecode eq 0                              equality
contains(name, 'Contoso')                   string contains
startswith(name, 'A')                       string starts with
revenue gt 100000                           numeric comparison
statecode eq 0 and address1_country eq 'AU' logical and
```

**Always use `select`** to limit the columns returned. Fetching full records from Dataverse is expensive and unnecessary when you only need a few fields.

---

## Step 3: Build the Accounts Page

Now we use those generated files to build the first real screen. We will create `src/pages/accounts.tsx` - an Accounts list with search.

### The Page Component

```tsx
// src/pages/accounts.tsx
import { useState, useDeferredValue } from "react"
import { useQuery } from "@tanstack/react-query"
import { AccountsService } from "@/generated/services/AccountsService"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function AccountsPage() {
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)

  const { data: accounts = [], isLoading, isError } = useQuery({
    queryKey: ["accounts", deferredSearch],
    queryFn: async () => {
      const result = await AccountsService.getAll({
        select: ["name", "accountnumber", "address1_city", "telephone1", "statecode"],
        filter: deferredSearch ? `contains(name, '${deferredSearch}')` : undefined,
        orderBy: ["name asc"],
        top: 50,
      })
      return result.data ?? []
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
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Account Number</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            accounts.map((account) => (
              <TableRow key={account.accountid} className="cursor-pointer hover:bg-muted/50">
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

A few things worth explaining in this component:

**`useDeferredValue` instead of debounce**

When the user types in the search box, we do not want to fire a Dataverse query on every single keystroke. The standard approach is to debounce - delay the query until the user stops typing. React's built-in `useDeferredValue` achieves the same result without a custom hook: it tells React to keep using the previous value while the new one is being processed, so the query only fires once the UI has settled. The `queryKey` uses `deferredSearch`, not `search`, so Tanstack Query only refetches when the deferred value actually changes.

**`queryKey: ["accounts", deferredSearch]`**

Tanstack Query caches results by key. Every unique `[accounts, searchTerm]` combination is cached separately. If the user searches for "Contoso", navigates away, and comes back, the cached result appears instantly while a background refresh runs. This is free behavior from Tanstack Query - no extra code needed.

**`result.data ?? []`**

The service returns `{ data: Accounts[] }`. The `queryFn` unwraps it so the component works directly with the array. The `?? []` default means the component never has to handle `undefined` - it always gets an array.

**`statecode === 0`**

Dataverse status codes are numbers. `statecode 0` is Active, `statecode 1` is Inactive. This is standard Dataverse convention across all tables. The `statuscode` field carries the sub-status (the specific reason for the state) and is table-specific.

---

## Step 4: Wire Up the Route and Navigation

The page component exists but the app does not know about it yet. Update two files:

### `src/router.tsx`

Add the accounts route and enable the header:

```tsx
import { createBrowserRouter } from "react-router-dom"
import Layout from "@/pages/_layout"
import HomePage from "@/pages/home"
import AccountsPage from "@/pages/accounts"
import NotFoundPage from "@/pages/not-found"

const BASENAME = new URL(".", location.href).pathname
if (location.pathname.endsWith("/index.html")) {
  history.replaceState(null, "", BASENAME + location.search + location.hash);
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout showHeader={true} />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "accounts", element: <AccountsPage /> },
    ],
  },
], {
  basename: BASENAME
})
```

### `src/pages/_layout.tsx`

Add the Accounts nav link:

```tsx
import { Outlet, NavLink } from "react-router-dom"

type LayoutProps = { showHeader?: boolean }

export default function Layout({ showHeader = true }: LayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col">
      {showHeader && (
        <header className="h-14 border-b flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6 flex items-center gap-6">
            <span className="font-semibold text-sm">CRM Sales Hub</span>
            <nav className="flex items-center gap-4">
              <NavLink to="/" end
                className={({ isActive }) =>
                  `text-sm text-muted-foreground hover:text-foreground ${isActive ? "text-foreground font-medium" : ""}`
                }
              >
                Home
              </NavLink>
              <NavLink to="/accounts"
                className={({ isActive }) =>
                  `text-sm text-muted-foreground hover:text-foreground ${isActive ? "text-foreground font-medium" : ""}`
                }
              >
                Accounts
              </NavLink>
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1 flex">
        <div className="flex-1 mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
```

---

## Step 5: Run and Verify

```bash
npm run dev
```

Open the Local Play URL, navigate to **Accounts** in the header. You should see:

1. A loading skeleton while the query runs
2. Your real Account records from Dynamics 365 rendered in the table
3. Search working - typing in the box filters records via a live Dataverse `contains` query

---

## What Is Actually Happening at Runtime

When `AccountsService.getAll()` is called, the call path is:

```
Your component
  -> AccountsService.getAll()     (generated service)
     -> Power Apps SDK            (@microsoft/power-apps)
        -> Power Apps host        (connector proxy in the browser)
           -> Dataverse connector
              -> Your Dynamics 365 environment
```

You are not calling the Dataverse Web API directly. The SDK routes the request through the Power Apps host, which applies your tenant's DLP policies, uses the user's existing Entra session for authentication, and proxies the call to Dataverse on your behalf.

This is why there is no auth code, no API keys, and no CORS configuration in the project. The host handles all of it.

---

## Key Takeaways

- `pac code add-data-source -a dataverse -t <table>` adds a Dataverse table and generates typed model and service files in `src/generated/`
- Do not edit files in `src/generated/` - they are regenerated when data sources change
- The model file is a TypeScript interface matching your Dataverse table schema - nullable columns are typed as `T | null`
- The service file exposes `getAll`, `get`, `create`, `update`, `delete` - each returning a Promise
- Always use the `select` option in `getAll` to limit columns
- Option set fields like `statecode` are typed as `string` in the generated model but return as `number` at runtime — use `Number(account.statecode) === 0` to safely handle both
- The SDK generates `*name` companion fields in the model (e.g., `statecodename`) but do NOT put them in `select` - they are Dataverse annotations, not real columns, and will cause a 400 error if selected explicitly
- The `filter` option accepts standard OData v4 expressions - the same syntax as the Dataverse Web API
- Use Tanstack Query's `useQuery` to wrap service calls - you get caching, loading states, and error handling for free
- `useDeferredValue` is a clean way to avoid firing queries on every keystroke without writing a custom debounce hook
- At runtime, all data calls go through the Power Apps host connector proxy - no direct Dataverse API calls, no auth to configure

---

## What's Next

In Chapter 4, we go deeper into CRUD. We will build an Account detail page that shows related Contacts and Opportunities, and add the ability to create and edit an Opportunity. That is where the nuances come in - system fields you cannot set on create, partial updates, and working with lookups.

---

*Previous: Chapter 2 - Hello World & Tooling*
*Next: Chapter 4 - Full CRUD for CRM Records*
