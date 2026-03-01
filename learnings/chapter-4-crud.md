# Chapter 4: Full CRUD for CRM Records

> **Blog post title:** CRM CRUD in Power Apps Code Apps: Gotchas with Lookups, Option Sets, and Required Fields
>
> **Audience:** Following along from Chapter 3. You have an Accounts list reading live Dataverse data. Now we go deeper: fetching related records, creating, and deleting.

---

## Introduction

Chapter 3 covered reading data. One table, one list, one query. That is enough to understand the pattern. But a real CRM app needs more: navigating to a record, seeing related data side by side, creating new records linked to an existing one, and deleting.

Chapter 4 builds all of that. By the end we have:

- An Account detail page showing related Opportunities and Contacts in tabs
- A dialog to create a new Opportunity linked to the Account
- Delete on each Opportunity row
- Clickable rows in the Accounts list that navigate to the detail page

Along the way, we hit the real nuances of CRUD against Dataverse, the ones a generated service layer does not abstract away for you.

---

## What We Are Building

```
Accounts list  ──(click row)──►  Account Detail
                                 ├── Header: name, city, phone, status
                                 ├── [Opportunities tab]
                                 │     [+ New Opportunity]
                                 │     Table: name, rating, value, close date, [Delete]
                                 └── [Contacts tab]
                                       Table: name, job title, email, phone
```

---

## Step 1: Make Account Rows Clickable

In `accounts.tsx`, add `useNavigate` and attach an `onClick` to each row:

```tsx
import { useNavigate } from "react-router-dom"

// inside the component:
const navigate = useNavigate()

// on the TableRow:
<TableRow
  key={account.accountid}
  className="cursor-pointer hover:bg-muted/50"
  onClick={() => navigate(`/accounts/${account.accountid}`)}
>
```

And register the new route in `router.tsx`:

```tsx
import AccountDetailPage from "@/pages/account-detail"

// in the routes array:
{ path: "accounts/:accountId", element: <AccountDetailPage /> },
```

---

## Step 2: The Account Detail Page

### Reading the URL Parameter

React Router makes the `accountId` from the URL available via `useParams`:

```tsx
const { accountId } = useParams<{ accountId: string }>()
```

### Fetching Three Things at Once

The detail page needs three separate queries running in parallel: the account itself, its related opportunities, and its related contacts. Tanstack Query handles this naturally. Just declare multiple `useQuery` calls and they fire simultaneously:

```tsx
const { data: account } = useQuery({
  queryKey: ["account", accountId],
  queryFn: async () => {
    const result = await AccountsService.get(accountId!)
    return result.data
  },
  enabled: !!accountId,
})

const { data: opportunities = [] } = useQuery({
  queryKey: ["opportunities", accountId],
  queryFn: async () => {
    const result = await OpportunitiesService.getAll({
      select: ["name", "estimatedvalue", "estimatedclosedate", "opportunityratingcode", "statecode"],
      filter: `_parentaccountid_value eq ${accountId}`,
      orderBy: ["createdon desc"],
    })
    return result.data ?? []
  },
  enabled: !!accountId,
})

const { data: contacts = [] } = useQuery({
  queryKey: ["contacts", accountId],
  queryFn: async () => {
    const result = await ContactsService.getAll({
      select: ["fullname", "firstname", "lastname", "jobtitle", "emailaddress1", "telephone1"],
      filter: `_accountid_value eq ${accountId}`,
      orderBy: ["lastname asc"],
    })
    return result.data ?? []
  },
  enabled: !!accountId,
})
```

**`enabled: !!accountId`** tells Tanstack Query not to fire the query until `accountId` has a value. Without it, the query would run immediately on mount with `accountId` as `undefined`, which would produce a bad API call.

### Filtering Related Records

The OData filter for related records uses the lookup value field:

```
_parentaccountid_value eq ${accountId}   ← opportunities linked to this account
_accountid_value eq ${accountId}          ← contacts linked to this account
```

These `_*_value` fields are the read-only GUID fields that Dataverse stores for each lookup relationship. They are what you filter on, not the navigation property name.

### Option Set Mapping

The `opportunityratingcode` field comes from the model as `Opportunitiesopportunityratingcode` (a union of `1 | 2 | 3`) but arrives at runtime as a number. Map it to a display label with a simple record:

```tsx
const RATING_LABELS: Record<number, string> = { 1: "Hot", 2: "Warm", 3: "Cold" }

// in JSX:
{RATING_LABELS[Number(opp.opportunityratingcode)] ?? "-"}
```

This is cleaner than a switch or ternary chain when there are three or more values.

---

## Step 3: Creating a Record

### `useMutation`

For data writes, Tanstack Query provides `useMutation`. While `useQuery` runs automatically and manages a cache, `useMutation` runs only when you call `.mutate()` and gives you `isPending`, `isError`, and `onSuccess` / `onError` callbacks:

```tsx
const createOpportunity = useMutation({
  mutationFn: async () => { /* the write */ },
  onSuccess: () => { /* what to do after */ },
})

// trigger it:
createOpportunity.mutate()

// disable the button while running:
disabled={createOpportunity.isPending}
```

### Query Invalidation: How the List Refreshes

After a successful create, you want the Opportunities list to reload and show the new record. The mechanism is **query invalidation**:

```tsx
const queryClient = useQueryClient()

// in onSuccess:
queryClient.invalidateQueries({ queryKey: ["opportunities", accountId] })
```

`invalidateQueries` marks the cached data for that key as stale, which triggers an automatic background refetch. The list updates without any manual state management.

### Linking the Opportunity to an Account

When you **read** an opportunity, the related account appears as `_parentaccountid_value`, a plain GUID string. But that field is read-only. You cannot set it directly on create.

The Opportunity customer field is a **polymorphic lookup**, meaning it can point to either an Account or a Contact. In Dataverse's OData API, polymorphic lookups use a typed bind syntax:

```tsx
"customerid_account@odata.bind": `/accounts(${accountId})`
```

The pattern is `<fieldname>_<entitytype>@odata.bind`. For a Contact customer it would be `customerid_contact@odata.bind`.

Three approaches that look reasonable but **do not work**:

| What you might try | Why it fails |
|---|---|
| `customerid: accountId, customeridtype: "account"` | `customerid` does not exist as a plain property on the OData type |
| `"ParentAccountId@odata.bind": "/accounts(id)"` | PascalCase not recognised — Dataverse navigation properties are lowercase |
| `_parentaccountid_value: accountId` | Read-only — cannot be set on create |

The typed bind is the one that actually works.

### Numeric Fields Are Typed as `string` but Must Be Sent as Numbers

This is the same mismatch we saw with `statecode` in Chapter 3, but it bites harder on create.

The generated model types currency and decimal fields as `string`:

```typescript
estimatedvalue?: string;   // wrong — Dataverse expects Edm.Decimal
```

If you send `"estimatedvalue": "123"` (a quoted string), Dataverse rejects it:
*"Cannot convert a value to target type 'Edm.Decimal' because of conflict between input format string/number."*

You must send `"estimatedvalue": 123` (an unquoted number). The fix is `Number(form.estimatedvalue)` before passing it to the service.

The same applies to any currency, decimal, or integer field. Always convert with `Number()` before sending on create or update.

### Required Fields and the Type Cast

The `OpportunitiesBase` interface marks several fields as required that Dataverse will actually default server-side (`ownerid`, `owneridtype`, `TransactionCurrencyId@odata.bind`). Combined with the numeric type mismatches above, the generated TypeScript type simply does not match what the API actually needs.

The pragmatic solution is to cast the entire create payload to `as any`. This is not ideal, but it is honest. The generated types are unreliable enough on writes that trying to satisfy them creates more noise than safety:

```tsx
await OpportunitiesService.create({
  name: form.name,
  "customerid_account@odata.bind": `/accounts(${accountId})`,
  statecode: 0,
  ...(form.estimatedvalue && { estimatedvalue: Number(form.estimatedvalue) }),
  ...(form.estimatedclosedate && { estimatedclosedate: form.estimatedclosedate }),
  ...(form.rating && { opportunityratingcode: Number(form.rating) }),
} as any)
```

The spread syntax (`...(condition && { field: value })`) keeps the payload clean. If `form.estimatedvalue` is an empty string, the spread evaluates to `false` and nothing is added. No empty strings reach the API.

### `customerid` and `customeridtype`

Opportunity has a polymorphic customer field that can link to either an Account or a Contact. The SDK requires you to specify both the ID and the type:

```tsx
customerid: accountId,
customeridtype: "account",
```

---

## Step 4: Deleting a Record

Delete is the simplest mutation. Just pass the record ID:

```tsx
const deleteOpportunity = useMutation({
  mutationFn: (opportunityId: string) => OpportunitiesService.delete(opportunityId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["opportunities", accountId] })
  },
})

// trigger it passing the ID:
deleteOpportunity.mutate(opp.opportunityid)
```

Disable the button while a delete is pending to prevent double-clicks:

```tsx
disabled={deleteOpportunity.isPending}
```

---

## Key Takeaways

- Multiple `useQuery` calls in one component run in parallel. Tanstack Query fires them simultaneously
- Use `enabled: !!id` to prevent queries from running before a URL parameter has a value
- Filter related records using the `_*_value` lookup field: `_parentaccountid_value eq ${accountId}`
- Use `useMutation` for writes. It gives you `isPending`, `onSuccess`, and `onError` without manual state
- After a mutation, call `queryClient.invalidateQueries()` to trigger a background refetch of the affected list
- To link an Opportunity to an Account on create, use the polymorphic typed bind: `"customerid_account@odata.bind": "/accounts(id)"`. The pattern is `<fieldname>_<entitytype>@odata.bind`
- The `_*_value` field (e.g., `_parentaccountid_value`) is read-only and not writable on create
- `customerid` + `customeridtype` as plain properties do not exist on the Opportunity OData type and will cause a 400 error
- The generated `OpportunitiesBase` type includes `"ParentAccountId@odata.bind"` fields but do not use them. PascalCase navigation properties are not recognised by Dataverse
- Decimal and currency fields (e.g., `estimatedvalue`) are typed as `string` in the generated model but **must be sent as numbers**. Use `Number(value)` before passing them, or Dataverse returns a 400 Edm.Decimal error
- The generated types are unreliable enough on writes that `as any` is the honest cast. The type says `string`, the API needs `number`, and satisfying the type makes the API call fail
- The spread trick `...(value && { field: value })` is a clean way to include optional fields only when they are non-empty, avoiding sending empty strings to the API

---

## What's Next

In Chapter 5, we build the Dashboard screen: pipeline charts, KPI cards, and data aggregation from Dataverse. This is where Code Apps pulls clearly ahead of Canvas App: a real charting library, full control over the layout, and data shaped exactly how you need it.

---

*Previous: Chapter 3 - Connecting to Dataverse*
*Next: Chapter 5 - Dashboard & Data Visualization*
