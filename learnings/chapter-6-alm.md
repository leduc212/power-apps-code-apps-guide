# Chapter 6: Context, ALM & Production Readiness

> **Blog post title:** Shipping a Power Apps Code App to Production: Context, ALM, Solutions, and Pipelines
>
> **Audience:** Following along from Chapter 5. You have a working dashboard on live Dataverse data. Now we personalise the app for the signed-in user and move it from Dev to Test to Production.
>
> **Updated September 2026** for SDK 1.4 and the Power Apps CLI (`pa`). Several ALM commands in the February version were wrong or have changed. The original is at the [`v1-feb-2026`](https://github.com/leduc212/power-apps-code-apps-guide/tree/v1-feb-2026) tag.

---

## Introduction

Chapters 1-5 covered building. This chapter covers two things that take an app from demo to deployment:

1. **Context**: who is signed in, and how to personalise the experience
2. **ALM**: getting the app into a solution and moving it between environments

Context is a code topic. ALM is mostly a platform topic with a handful of commands. Both matter.

---

## Part 1: User Context with `getContext()`

### What `getContext()` Returns

```typescript
import { getContext } from "@microsoft/power-apps/app"

const context = await getContext()
```

The shape, as of SDK 1.4:

```typescript
interface IContext {
  app: {
    appId: string
    environmentId: string
    appSettings: object                   // player settings, e.g. showHeader
    queryParams: Record<string, string>   // custom query params on the play URL
    dataverseOrgUrl?: string              // new in 1.4, when the host provides it
    appUrl?: string                       // new in 1.4, when the host provides it
  }
  host: {
    sessionId: string
  }
  user: {
    fullName?: string
    objectId?: string          // Entra (Azure AD) object ID
    tenantId?: string
    userPrincipalName?: string
  }
}
```

Every `user` field is optional, and the two new `app` fields are only there when the host fills them in. Treat all of them as possibly missing.

### Wrapping `getContext()` in a Hook

`getContext()` returns a promise that resolves when the Power Apps host answers. **If there is no host, it never resolves.** Open the app on plain `localhost`, or embed it somewhere unexpected, and anything waiting on context waits forever. So give it a deadline:

```typescript
// src/lib/context.ts
import { getContext, type IContext } from "@microsoft/power-apps/app"

/** getContext() waits on the Power Apps host; outside the player it never resolves. */
const CONTEXT_TIMEOUT_MS = 3000

export function getContextWithTimeout(ms = CONTEXT_TIMEOUT_MS): Promise<IContext> {
  return Promise.race([
    getContext(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("getContext timed out")), ms)),
  ])
}
```

```typescript
// src/hooks/useAppContext.ts
export function useAppContext() {
  return useQuery({
    queryKey: ["app-context"],
    queryFn: () => getContextWithTimeout(),
    staleTime: Infinity, // context is stable for the lifetime of a session
  })
}
```

The helper is separate from the hook because non-React code needs context too (Chapter 9's deep links).

`staleTime: Infinity` because context doesn't change during a session. The timeout turns "hangs forever" into an ordinary query error that the UI can ignore or report.

### Showing the User's Name in the Header

```tsx
// src/pages/_layout.tsx
const { data: ctx } = useAppContext()

{ctx?.user.fullName && (
  <span className="ml-auto text-sm text-muted-foreground">
    {ctx.user.fullName}
  </span>
)}
```

Optional chaining covers every case: context still loading, context timed out, or a host that didn't supply a name. The header simply shows nothing.

---

## Part 2: Personalisation ("My Opportunities")

Filtering to what belongs to the current user, "My Opportunities", runs straight into a Dataverse gotcha.

### `objectId` Is Not `systemuserid`

`context.user.objectId` is the user's **Entra object ID**. Dataverse's `_ownerid_value` holds the owner's **`systemuserid`**, a different GUID assigned when the user was added to Dataverse.

So this filter looks right and silently returns nothing:

```
_ownerid_value eq ${context.user.objectId}
```

### The Resolution Pattern

Dataverse stores the mapping on the `systemuser` table, in `azureactivedirectoryobjectid`.

1. Add the table:
   ```bash
   pa app add data-source --connector dataverse --table systemuser
   ```
2. Look up the current user:
   ```typescript
   const result = await SystemusersService.getAll({
     select: ["systemuserid"],
     filter: `azureactivedirectoryobjectid eq ${context.user.objectId}`,
     top: 1,
   })
   const systemUserId = unwrap(result, "Resolve current user")[0]?.systemuserid
   ```
3. Filter on it:
   ```
   _ownerid_value eq ${systemUserId}
   ```

In practice, chain these: a second `useQuery` with `enabled: !!ctx?.user.objectId` and `staleTime: Infinity`. Resolve it once per session and share it.

Many real apps also keep their **own** user table: which team someone belongs to, what they're allowed to do in the app. The same rule applies there. Key it on something Dataverse and Entra agree on (`systemuserid`, or the UPN), not on the display name.

---

## Part 3: ALM, Solutions, and Deployment

Code Apps follow the same solution model as Canvas and Model-Driven Apps. The app, and the connection references it uses, live in a solution, and the solution moves between environments.

> **Which CLI for what:** `pa` builds and publishes the app. Solution export/import and deployment pipelines are still Power Platform CLI (`pac`) commands, or buttons in the maker portal.

### Step 1: Create a Solution in Dev

In the maker portal, create an unmanaged solution in your Dev environment and note its publisher prefix. Then find its ID:

```bash
pa solution list --search crmsaleshub
```

### Step 2: Bind Data Sources to Connection References

This is the step that makes the app portable, and the February version of this chapter skipped it.

A **connection** belongs to a person in one environment. A **connection reference** is a solution component that says "use *a* connection for this connector", and each environment supplies its own connection when the solution is imported. Add non-Dataverse data sources through a reference, not a direct connection:

```bash
pa connection list-references --solution-id <solution-id>

pa app add data-source \
  --connector shared_office365users \
  --connection-ref <connection-reference-logical-name> \
  --solution-id <solution-id>
```

Dataverse tables don't need this. They always point at the Dataverse of whatever environment the app runs in.

**Environment variables** do a similar job for values that differ between environments, like a SharePoint site or list. Reference them with `@envvar:` when you add the data source:

```bash
pa app add data-source \
  --connector shared_sharepointonline \
  --connection-ref <connection-reference-logical-name> \
  --solution-id <solution-id> \
  --dataset "@envvar:new_SharePointSite" \
  --table "@envvar:new_SharePointList"
```

`pa app list-environment-variables` shows what's available.

> **Correction from February:** I wrote that environment variables arrive in `context.app.appSettings` at runtime. They don't; `appSettings` holds player settings like `showHeader`. The client library has no API for reading an environment variable's value. If your code needs one (an environment name for a banner, a feature flag), add the `environmentvariabledefinition` and `environmentvariablevalue` tables as data sources and query them: find the definition by schema name, then its current value, and fall back to the definition's default value. Cache the result for the session.

### Step 3: Push into the Solution

```bash
npm run build
pa app push --solution-id <solution-id>
```

From now on the solution, not the app on its own, is the unit you deploy.

### Step 4: Moving the Solution

**Manually** (fine for one developer):

```bash
pac solution export --name crmsaleshub --path ./export/crmsaleshub.zip --managed
pac auth create --environment https://your-test-env.crm.dynamics.com
pac solution import --path ./export/crmsaleshub.zip
```

Export managed for Test and Production; unmanaged solutions are for development environments where you still make changes. On import, each connection reference needs a connection in the target environment.

**With Power Platform Pipelines** (better for a team): an admin sets up a pipeline with Dev → Test → Production stages, and makers deploy from the solution's **Pipelines** page in the maker portal. From the command line:

```bash
pac pipeline list --pipeline "CRM Sales Hub"      # shows the stage IDs
pac pipeline deploy --solutionName crmsaleshub --stageId <stage-id> --currentVersion 1.0.0.1 --newVersion 1.0.0.2 --wait
```

Pipelines handle the managed export, connection references and environment variable values for each stage. That's the main reason to use them over manual export/import.

> **Correction from February:** the command I gave, `pac pipeline run --name ... --stageOrder 1`, doesn't exist. It's `pac pipeline deploy` with a stage ID.

### Step 5: Automate the Push (CI/CD)

`pa app push` can run without a person signing in, using a service principal:

```bash
pa app push --non-interactive --solution-id <solution-id>
```

The service principal needs **edit** access to the app. Share it with the principal's **Enterprise Application** object ID, not the App Registration's:

```bash
pa app share --principal <enterprise-app-object-id> --access edit
```

Microsoft's [service principal guide](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/use-service-principal) covers setting up the credentials for a build pipeline.

### Sharing Isn't Only the App

Sharing the app lets people open it. They still need:

- A Dataverse **security role** that can read (and write) the tables the app uses
- Access to any **flows** the app calls (Part 2 covers flows)
- Their own **connections** for non-Dataverse connectors, which they're prompted to create on first launch

Most "it works for me but not for them" reports are one of these, not a bug in the app.

---

## Key Takeaways

- `getContext()` never resolves without a host; wrap it in a timeout. Treat every `user` field as optional
- SDK 1.4 adds `app.dataverseOrgUrl` and `app.appUrl`, when the host supplies them
- `user.objectId` is the Entra object ID, not the Dataverse `systemuserid`; resolve it through `systemuser.azureactivedirectoryobjectid`
- `pa app push --solution-id` puts the app in a solution; the solution is what you deploy
- Add non-Dataverse data sources through **connection references**, and parameterise per-environment values with `@envvar:`
- `appSettings` is player settings, not environment variables; read environment variable values by querying their tables
- Deploy with `pac solution export/import` or `pac pipeline deploy`; automate `pa app push --non-interactive` with a service principal
- An app share isn't enough: users also need security roles, flow access and their own connections

---

## End of Part 1

Starting from "what is a Code App", we built a CRM app with:

- Live Dataverse data (Accounts, Contacts, Opportunities) with honest error handling
- Create and delete for Opportunities linked to Accounts
- A dashboard with KPI cards and recharts charts
- User context through `getContext()`
- A path to production through solutions, connection references and pipelines

The full source is in [`crm-sales-hub/`](../crm-sales-hub/).

**Part 2** covers what I only learned by shipping a production Code App that replaced a large Canvas App: paging large tables properly, calling Power Automate flows, releasing and supporting the app, rebuilding a Canvas App in code, and working with an AI coding agent.

---

*Previous: Chapter 5 - Dashboard & Data Visualization*
*Next: Chapter 7 - Data at Scale*
