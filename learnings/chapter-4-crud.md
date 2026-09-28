# Chapter 4: Full CRUD for CRM Records

> **Blog post title:** CRM CRUD in Power Apps Code Apps: Gotchas with Lookups, Option Sets, and Required Fields
>
> **Audience:** Following along from Chapter 3. You have an Accounts list reading live Dataverse data. Now we go deeper: related records, creating, updating and deleting.
>
> **Updated September 2026** for SDK 1.4 and the Power Apps CLI (`pa`). The original February text is at the [`v1-feb-2026`](https://github.com/leduc212/power-apps-code-apps-guide/tree/v1-feb-2026) tag.

---

## Introduction

Chapter 3 covered reading one table. A real CRM app needs more: opening a record, seeing related data side by side, creating records linked to it, and deleting.

By the end of this chapter we have:

- An Account detail page with related Opportunities and Contacts in tabs
- A dialog that creates an Opportunity linked to the Account
- Delete on each Opportunity row
- Clickable rows in the Accounts list

Along the way we hit the parts of Dataverse CRUD that a generated service layer doesn't hide from you.

---

## What We Are Building

```
Accounts list  ──(click row)──►  Account Detail
                                 ├── Header: name, number, city, phone, status
                                 ├── [Opportunities tab]
                                 │     [+ New Opportunity]
                                 │     Table: name, rating, value, close date, [Delete]
                                 └── [Contacts tab]
                                       Table: name, job title, email, phone
```

---

## Step 1: Make Account Rows Clickable

In `accounts.tsx`, navigate on row click:

```tsx
const navigate = useNavigate()

<TableRow
  key={account.accountid}
  className="cursor-pointer hover:bg-muted/50"
  onClick={() => navigate(`/accounts/${account.accountid}`)}
>
```

And register the route in `router.tsx`:

```tsx
{ path: "accounts/:accountId", element: <AccountDetailPage /> },
```

---

## Step 2: The Account Detail Page

### Three Queries in Parallel

The page needs the account, its opportunities and its contacts. Declare three `useQuery` calls and TanStack Query runs them at the same time:

```tsx
const { accountId } = useParams<{ accountId: string }>()

const { data: account, isLoading: loadingAccount, error: accountError } = useQuery({
  queryKey: ["account", accountId],
  queryFn: async () => {
    const result = await AccountsService.get(accountId!)
    return unwrap(result, "Load account")
  },
  enabled: !!accountId,
})

const { data: opportunities = [], isLoading: loadingOpps, error: oppsError } = useQuery({
  queryKey: ["opportunities", accountId],
  queryFn: async () => {
    const result = await OpportunitiesService.getAll({
      select: ["name", "estimatedvalue", "estimatedclosedate", "opportunityratingcode", "statecode"],
      filter: `_parentaccountid_value eq ${accountId}`,
      orderBy: ["createdon desc"],
    })
    return unwrap(result, "Load opportunities")
  },
  enabled: !!accountId,
})

const { data: contacts = [], isLoading: loadingContacts, error: contactsError } = useQuery({
  queryKey: ["contacts", accountId],
  queryFn: async () => {
    const result = await ContactsService.getAll({
      select: ["fullname", "firstname", "lastname", "jobtitle", "emailaddress1", "telephone1"],
      filter: `_accountid_value eq ${accountId}`,
      orderBy: ["lastname asc"],
    })
    return unwrap(result, "Load contacts")
  },
  enabled: !!accountId,
})
```

**`enabled: !!accountId`** stops a query from firing before the route parameter exists.

**`unwrap`** (from Chapter 3) turns a failed request into an error, so each query's `error` is real. The page shows it instead of pretending the account doesn't exist:

```tsx
if (accountError) {
  return <div className="p-6 text-sm text-destructive">Failed to load the account: {accountError.message}</div>
}
```

The Opportunities and Contacts tabs each show their own error line the same way, so one failing query doesn't blank the whole page.

### Filtering Related Records

Related rows are filtered on the lookup's value column:

```
_parentaccountid_value eq ${accountId}   ← opportunities linked to this account
_accountid_value eq ${accountId}          ← contacts linked to this account
```

`_<lookup>_value` holds the related record's GUID. It's what you filter and read on. There's no `$expand` in the Dataverse connector for Code Apps, so "show the account with its contacts" is always two queries, not one. That's fine: they run in parallel.

### Choice Labels

`opportunityratingcode` is a choice column (Hot/Warm/Cold). As Chapter 3 explained, Dataverse sends the label with the value, so read it from the annotation:

```tsx
const RATING_LABELS: Record<number, string> = { 1: "Hot", 2: "Warm", 3: "Cold" }

<TableCell>
  {formattedValue(opp, "opportunityratingcode") ?? RATING_LABELS[Number(opp.opportunityratingcode)] ?? "-"}
</TableCell>
```

The local map is only a fallback. The annotation also respects the user's language and any labels your organization customized, which a hard-coded map never will.

---

## Step 3: Creating a Record

### `useMutation`

Writes use TanStack Query's `useMutation`. It runs only when you call `.mutate()`, and gives you `isPending`, `onSuccess` and `onError`:

```tsx
const createOpportunity = useMutation({
  mutationFn: async () => { /* the write */ },
  onSuccess: () => { /* refresh + close the dialog */ },
  onError: (error) => toast.error(`Could not create the opportunity: ${error.message}`),
})
```

`onError` matters as much as `onSuccess`. The starter template already mounts a `sonner` toaster, so a failed write shows the user why instead of the dialog just sitting there.

### Refreshing the List: Query Invalidation

After a successful create, mark the cached opportunities list as stale and TanStack Query refetches it:

```tsx
const queryClient = useQueryClient()

onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["opportunities", accountId] })
}
```

### Linking the Opportunity to the Account

When you **read** an opportunity, its account is in `_parentaccountid_value`, a plain GUID. That column is read-only; you can't set it on create.

To set a lookup on create or update, you bind the **navigation property** to the related record with `@odata.bind`:

```tsx
"<navigation-property>@odata.bind": "/<entity-set>(<guid>)"
```

The navigation property name is **case-sensitive** and must match the table's metadata exactly. For system lookups it's usually lowercase (`parentaccountid`). For custom lookups it usually keeps its schema-name casing, like `new_ParentOrder@odata.bind`.

**Don't trust the bind keys in the generated model.** `OpportunitiesBase` declares keys like `"ParentAccountId@odata.bind"`. The generator builds them from the lookup's *schema name*, and on system tables that often isn't the navigation property name (`parentaccountid`). Using the generated key is exactly what failed for me in February. On custom tables the two names usually match, which is why binds there tend to work first time. The reliable source is the navigation property itself: the generated model lists it as a plain property typed `object` (`parentaccountid?: object`), and the table's metadata in the Web API (`$metadata`) has the definitive name.

The Opportunity's **Customer** field is **polymorphic**: it can point to an Account or a Contact. Its bind names the target type:

```tsx
"customerid_account@odata.bind": `/accounts(${accountId})`
```

The demo uses this, and it worked when I built the demo in February. **However,** the Dataverse docs for Code Apps (August 2026) list polymorphic lookups as not supported. If it fails in your environment, bind the plain Account lookup instead, which isn't polymorphic:

```tsx
"parentaccountid@odata.bind": `/accounts(${accountId})`
```

Approaches that look reasonable but don't work:

| What you might try | Why it fails |
|---|---|
| `_parentaccountid_value: accountId` | The `_value` column is read-only |
| `customerid: accountId, customeridtype: "account"` | Not properties Dataverse accepts on write |
| `"ParentAccountId@odata.bind": "..."` (the key the generated model offers) | Schema name, not the navigation property name, which is `parentaccountid` |

> **Correction from February:** I wrote that PascalCase isn't recognised because navigation properties are always lowercase. The real rule is "use the exact navigation property name", and the generated model's bind keys can't be relied on to give it to you. The name is often mixed-case on custom tables. The February chapter also had a leftover paragraph saying `customerid` + `customeridtype` were required, which contradicted its own table. They aren't, and that paragraph is gone.

### Numbers Must Be Sent as Numbers

The generated model types money and decimal columns as strings:

```typescript
estimatedvalue?: string;
```

Send `"123"` and Dataverse rejects it: *"Cannot convert a value to target type 'Edm.Decimal' because of conflict between input format string/number."* Send `123`. Convert with `Number()` before any create or update, for every money, decimal, integer and choice column.

### The Payload and the Type Cast

```tsx
const createOpportunity = useMutation({
  mutationFn: async () => {
    const result = await OpportunitiesService.create({
      name: form.name,
      "customerid_account@odata.bind": `/accounts(${accountId})`,
      statecode: 0,
      ...(form.estimatedvalue && { estimatedvalue: Number(form.estimatedvalue) }),
      ...(form.estimatedclosedate && { estimatedclosedate: form.estimatedclosedate }),
      ...(form.rating && { opportunityratingcode: Number(form.rating) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    return unwrap(result, "Create opportunity")
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["opportunities", accountId] })
    setShowCreateDialog(false)
    setForm({ name: "", estimatedvalue: "", estimatedclosedate: "", rating: "" })
  },
  onError: (error) => toast.error(`Could not create the opportunity: ${error.message}`),
})
```

Why `as any`? On the generator this demo was built with, the create type (`Omit<OpportunitiesBase, 'opportunityid'>`) requires fields Dataverse fills in itself (owner, currency), types numbers as strings, and only offers the schema-name bind keys described above (with none at all for the polymorphic customer). Satisfying the type makes the request fail. Microsoft's docs cast to the generated type instead (`as Omit<Accounts, 'accountid'>`), which works when your payload has no binds. Keep the cast in one place, right at the call, and don't let `any` leak further.

The spread trick `...(value && { field: value })` adds optional fields only when they have a value, so empty strings never reach the API.

---

## Step 4: Updating a Record

The demo doesn't have an edit form, but updates are the easiest place to cause subtle damage, so here's the rule: **send only the fields that changed.**

```typescript
await OpportunitiesService.update(opportunityId, {
  name: "Renewal 2027",
  estimatedvalue: 25000,
} as any).then((r) => unwrap(r, "Update opportunity"))
```

Don't load a record, change one field, and send the whole object back. Dataverse treats every property you send as changed: it runs plugins and flows that trigger on those columns, and writes audit history saying someone changed values they never touched.

---

## Step 5: Deleting a Record

```tsx
const deleteOpportunity = useMutation({
  mutationFn: (opportunityId: string) => OpportunitiesService.delete(opportunityId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["opportunities", accountId] })
  },
  onError: (error) => toast.error(`Could not delete the opportunity: ${error.message}`),
})

// in the row:
<Button disabled={deleteOpportunity.isPending} onClick={() => deleteOpportunity.mutate(opp.opportunityid)}>
  Delete
</Button>
```

**A gotcha with delete:** unlike the other methods, the generated `delete()` in this demo returns `Promise<void>`. It awaits the client library and **discards the result**, so a delete that Dataverse rejects (no permission, a restricting relationship) resolves as if it succeeded. You can't `unwrap` it, and you shouldn't edit the generated file. `onError` still catches problems that throw. For deletes that matter, refetch afterwards and check the record is actually gone. Newer generator versions may return the result; check your own `delete()` signature.

Disable the button while the delete is pending to prevent double clicks.

---

## Key Takeaways

- Multiple `useQuery` calls run in parallel; `enabled: !!id` waits for the route parameter
- Filter related records on `_<lookup>_value`; there's no `$expand`, so related data is a separate query
- Give every query and mutation a visible error path: `unwrap` + `error`/`isError` for reads, `onError` + a toast for writes
- Read choice labels from the `FormattedValue` annotation; keep local maps only as a fallback
- Set lookups with `"<navigation-property>@odata.bind": "/<entity-set>(<id>)"`, using the exact, case-sensitive navigation property name, not the schema-name keys in the generated model
- Polymorphic binds (`customerid_account@odata.bind`) worked in the demo but are officially unsupported; bind `parentaccountid` if they fail
- Send numbers as numbers (`Number()`), and on update send only what changed
- The generated `delete()` may drop the result, so a failed delete can look like success

---

## What's Next

In Chapter 5 we build the Dashboard: KPI cards and charts from live data. That's where Code Apps pulls clearly ahead of Canvas: a real charting library, full layout control, and data shaped exactly how you need it.

---

*Previous: Chapter 3 - Connecting to Dataverse*
*Next: Chapter 5 - Dashboard & Data Visualization*
