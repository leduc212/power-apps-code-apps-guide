# Chapter 6: Context, ALM & Production Readiness

> **Blog post title:** Shipping a Power Apps Code App to Production: Context, ALM, Solutions, and Pipelines
>
> **Audience:** Following along from Chapter 5. You have a working dashboard with live Dataverse data. Now we personalise the app for the logged-in user, and cover the path from local development to a production Power Platform environment.

---

## Introduction

Chapters 1–5 covered building. Chapter 6 covers the last two things that take an app from a portfolio demo to a real deployment:

1. **Context** — knowing who the logged-in user is, and using that to personalise the experience
2. **ALM** — packaging the app into a Solution, and using Power Platform Pipelines to deploy from Dev to Test to Production

These are different in kind. Context is a code topic. ALM is mostly a platform-admin topic with a handful of CLI commands. Both matter for production.

---

## Part 1: User Context with `getContext()`

### What `getContext()` Returns

The `@microsoft/power-apps` SDK exposes a single `getContext()` function that, when the app is running inside the Power Apps host, returns information about the current session:

```typescript
import { getContext } from "@microsoft/power-apps/app"

const context = await getContext()
```

The returned object has this shape:

```typescript
interface IContext {
  app: {
    appId: string;
    environmentId: string;
    appSettings: object;
    queryParams: Record<string, string>;
  };
  host: {
    sessionId: string;
  };
  user: {
    fullName?: string;
    objectId?: string;       // Azure Active Directory Object ID
    tenantId?: string;
    userPrincipalName?: string;
  };
}
```

`user.fullName` is the display name of the signed-in user — the same name shown in the Power Apps header. `user.objectId` is their Azure AD Object ID (a GUID).

During local development (`npm run dev`), `getContext()` returns a mock context. The user fields will be empty or undefined — that is expected. The real values only appear when the app is hosted inside Power Apps.

### Wrapping `getContext()` in a Tanstack Query Hook

`getContext()` is an async function — it returns a Promise. The cleanest React pattern is to treat it like any other async data source and wrap it in a custom `useQuery` hook:

```typescript
// src/hooks/useAppContext.ts
import { useQuery } from "@tanstack/react-query"
import { getContext } from "@microsoft/power-apps/app"

export function useAppContext() {
  return useQuery({
    queryKey: ["app-context"],
    queryFn: () => getContext(),
    staleTime: Infinity, // context is stable for the lifetime of a session
  })
}
```

`staleTime: Infinity` means Tanstack Query will never mark this data as stale and refetch it automatically. User context does not change mid-session, so this is exactly right.

### Showing the User's Name in the Header

With the hook in place, consuming it anywhere in the app is a single line:

```tsx
// in _layout.tsx
import { useAppContext } from "@/hooks/useAppContext"

const { data: ctx } = useAppContext()

// in JSX:
{ctx?.user.fullName && (
  <span className="ml-auto text-sm text-muted-foreground">
    {ctx.user.fullName}
  </span>
)}
```

Because `user.fullName` is optional (`undefined` during local dev), the conditional render `ctx?.user.fullName &&` handles both cases cleanly: nothing shows locally, the user's name shows in production.

---

## Part 2: Personalisation — "My Opportunities"

A natural next step is filtering data to what belongs to the current user — "My Opportunities" or "My Accounts". This is where the context gives you just enough to run into a specific Dataverse gotcha worth knowing.

### The Gotcha: `objectId` ≠ `systemuserid`

`context.user.objectId` is the user's **Azure AD Object ID**. It looks like a GUID: `3fa85f64-5717-4562-b3fc-2c963f66afa6`.

Dataverse opportunities have an `_ownerid_value` field — the GUID of the owning user or team. This GUID is the Dataverse **`systemuserid`** — an internal ID assigned when the user record was created in Dataverse. It is a different GUID from the Azure AD Object ID.

This means the filter that looks correct:

```
_ownerid_value eq ${context.user.objectId}
```

will silently return zero results in most environments, because the two GUIDs do not match.

### The Correct Resolution Pattern

You need to resolve the AAD Object ID to a Dataverse `systemuserid`. Dataverse stores this mapping on the `systemuser` entity in the `azureactivedirectoryobjectid` field.

The approach:
1. Add `systemuser` as a data source:
   ```bash
   pac code add-data-source -a dataverse -t systemuser
   ```
2. Query the generated `SystemusersService` to find the current user's record:
   ```typescript
   const result = await SystemusersService.getAll({
     select: ["systemuserid"],
     filter: `azureactivedirectoryobjectid eq ${context.user.objectId}`,
     top: 1,
   })
   const systemUserId = result.data?.[0]?.systemuserid
   ```
3. Use `systemUserId` in the opportunity filter:
   ```
   _ownerid_value eq ${systemUserId}
   ```

In practice you would chain these two queries in a single `useQuery` — fetch context first, then fetch the systemuser record using the `objectId`, with `enabled: !!ctx?.user.objectId` to prevent the second query from firing before the first resolves. The systemuser result can also have `staleTime: Infinity` since it does not change.

This two-step pattern is the standard approach whenever you need to personalise Dataverse queries against the signed-in user.

---

## Part 3: ALM — Solutions and Deployment

Application Lifecycle Management (ALM) for Code Apps follows the same Power Platform solution model as Canvas Apps and Model-Driven Apps. The Code App artifact — the compiled bundle — lives inside a Solution and moves between environments using Power Platform Pipelines.

### Step 1: Create a Solution in Dev

In Power Platform admin / maker portal:
- Create an unmanaged solution in your Dev environment
- Note the solution's **publisher prefix** (e.g., `crmsaleshub`)

### Step 2: Link the App to a Solution

When you push the app with the PAC CLI, specify the solution:

```bash
npx power-apps push --solutionUniqueName crmsaleshub
```

This registers the Code App inside the solution. From this point, the solution is the unit of deployment — not the app directly.

### Step 3: Export from Dev

```bash
pac solution export --name crmsaleshub --path ./export --managed false
```

This creates an unmanaged solution zip in `./export`. Unmanaged solutions are for development — they allow changes. Managed solutions are for production — they lock customisations.

### Step 4: Import to Test/Production

```bash
pac solution import --path ./export/crmsaleshub.zip --activate-plugins --force-overwrite
```

Target the correct environment by first running:

```bash
pac auth create --url https://your-test-env.crm.dynamics.com
```

### Step 5: Automate with Power Platform Pipelines

Manual export/import works for a single developer. For a team, use **Power Platform Pipelines** (the built-in CI/CD tool in the Power Platform admin centre):

1. In the **Power Platform admin centre**, go to Pipelines
2. Create a pipeline with stages: Dev → Test → Production
3. Link your solution to the pipeline
4. Use the **Deploy** button in the maker portal, or trigger via the CLI:
   ```bash
   pac pipeline run --name "CRM Sales Hub Pipeline" --stageOrder 1
   ```

Pipelines handle the managed/unmanaged conversion, connection references, and environment variable substitution automatically — which is the main reason to use them over manual export/import.

### Environment Variables

If your app has configuration that differs between Dev and Production (API endpoints, feature flags, etc.), use **Power Platform Environment Variables** rather than hardcoding them. They integrate with solutions and are substituted automatically during pipeline deployment.

In the app, read them via `context.app.appSettings` — any environment variables scoped to the app are available there.

---

## Key Takeaways

- `getContext()` is imported from `"@microsoft/power-apps/app"` and returns a Promise — wrap it in `useQuery` with `staleTime: Infinity`
- `context.user.fullName` and `context.user.userPrincipalName` are immediately useful for personalisation; all user fields return `undefined` during local development — guard with optional chaining
- `context.user.objectId` is the Azure AD Object ID — **not** the Dataverse `systemuserid`; using it directly in `_ownerid_value` filters will silently return zero results
- To filter by the current user in Dataverse, resolve the objectId to a systemuserid by querying `systemuser` where `azureactivedirectoryobjectid eq ${objectId}`
- Code Apps follow the standard Power Platform ALM model: unmanaged solution in Dev, export, import as managed to Production
- Power Platform Pipelines automate the deployment chain and handle managed/unmanaged conversion, connection references, and environment variable substitution
- `context.app.appSettings` is where environment-specific configuration lands at runtime — use Power Platform Environment Variables to populate it rather than hardcoding values

---

## Series Complete

This is the final chapter of the CRM Sales Hub learning series. Starting from "what is a Code App" in Chapter 1, we built a production-ready CRM application with:

- Live Dataverse data (Accounts, Contacts, Opportunities)
- Full CRUD — create and delete Opportunities linked to Accounts
- A data-driven Dashboard with KPI cards and recharts bar charts
- User context personalisation via `getContext()`
- A documented path to production via Power Platform Solutions and Pipelines

The full source is in `crm-sales-hub/`. Run `npm run dev` to start locally.

---

*Previous: Chapter 5 - Dashboard & Data Visualization*
