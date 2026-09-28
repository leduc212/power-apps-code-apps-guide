# Chapter 8: Flows and Connectors

> **Blog post title:** Calling Power Automate Flows from a Power Apps Code App (and Knowing When They Actually Worked)
>
> **Audience:** You've read Chapter 7. Your app reads and writes Dataverse well. Now it needs to do things Dataverse alone can't: call another system, send a message, run logic on the server.
>
> **Part 2** is based on a production Code App we implemented to replace a large Canvas App. The patterns are real; the code is rewritten against this repo's demo tables.

---

## Introduction

Dataverse CRUD is half of a real app. The other half is everything around it: submitting an order to an ERP, moving a file into SharePoint, looking up a colleague's manager, emailing a customer. Our production app called about a dozen Power Automate flows, and one of them, the one that submitted orders to an external system, was the most important button in the app.

This chapter covers the three ways a Code App runs logic outside the browser, how to call each one, and the two lessons that cost us the most:

1. **A flow that returns `success: true` hasn't necessarily succeeded.**
2. **Anything that takes more than a moment needs to outlive the page that started it.**

---

## Three Ways to Run Logic on the Server

| | **Power Automate flow** | **Dataverse action / function** | **Connector, called directly** |
|---|---|---|---|
| Add with | `pa app add flow --flow-id <id>` | `pa app add dataverse-api --api-name <name>` | `pa app add data-source --connector <id> ...` |
| Good for | Multi-step work, other systems, approvals, SharePoint files | Built-in Dataverse operations (`WhoAmI`, `WinOpportunity`) and your own custom APIs | One call to one service: a user's profile, a Teams message |
| Runs as | The flow's connections (often a service account) | The signed-in user | The signed-in user's own connection |
| Change without redeploying the app | ✅ (if the inputs and outputs don't change) | ✅ (custom API logic) | ❌ |

What's *not* on the list: calling an API yourself. **Direct HTTP (`fetch`, `axios`, Microsoft Graph) doesn't work at runtime in a Code App**, which runs in a sandbox. Everything external goes through one of these three. If a service has no connector, wrap it in a custom connector or a flow.

A rough rule: if it's one call, call the connector directly. If it's several steps, needs credentials the user shouldn't have, or must be changeable without shipping the app, use a flow. If it's data logic that belongs next to the data (validation, aggregation, a multi-table update that must be atomic), use a Dataverse custom API.

---

## Adding a Flow

Code Apps can call **solution-aware instant flows with the Power Apps trigger**, and nothing else: not scheduled flows, not automated flows, not instant flows with other triggers. If a flow isn't in a solution, add it to one first. You also need `@microsoft/power-apps` 1.1.1 or later.

```bash
pa app list-flows --search "close deal"
pa app add flow --flow-id <flow-id>
```

`add flow` downloads the flow's definition and generates a typed service and model, like a Dataverse table, plus the flow's connection references in `power.config.json`. The person running it needs access to the flow **and** to every connection the flow uses, or it fails.

**When the flow's inputs or outputs change, run `pa app add flow` again with the same ID.** Nothing tells you the generated file is stale. The app keeps sending the old inputs until someone regenerates. Make "regenerate" part of every change to a flow's trigger or response.

To remove one: `pa app remove flow --flow-id <flow-id>`.

---

## Calling a Flow

The generated service has a static `Run` method that takes the trigger's inputs:

```typescript
// Example: a flow that closes a deal in an external system.
// "CloseDealFlowService" stands in for the service `pa app add flow` generates for your flow.
const result = await CloseDealFlowService.Run({ text: opportunityId, text_1: reason })
```

Open the generated model to see the real input names. They come from the flow's trigger, and **with the Power Apps trigger they're often not the names you gave the inputs.** In our production app, one flow's fifteen inputs were generated as `text`, `text_1`, ..., `text_14`, in the order the trigger declared them. Nothing stops you swapping two, and the flow will happily accept the wrong value in the wrong slot.

So wrap every flow in one typed function with real names, and keep the positional mapping in exactly one place:

```typescript
export async function closeDealInErp(input: { opportunityId: string; reason: string; lines: DealLine[] }) {
  const result = await CloseDealFlowService.Run({
    text: input.opportunityId,
    text_1: input.reason,
    text_2: JSON.stringify(input.lines),   // structured data travels as a JSON string
  })
  // ...see the next section
}
```

**Send structured data as `JSON.stringify(...)`**, and parse it in the flow with a Parse JSON action. Building JSON by string concatenation breaks the first time a value contains a quote or a newline, and text typed or scanned by users always eventually does.

---

## `success: true` Is Not Success

The generated `Run` returns the same `IOperationResult` as everything else, and `unwrap` from Chapter 3 applies: `success: false` means the flow couldn't be called or failed outright.

But `success: true` only means **the flow ran and responded**. It says nothing about whether the thing the flow was *for* worked. An ERP can reject the order. A file can be missing. The flow's own error-handling scope can catch the failure and respond normally with "it failed" in the body.

So give every flow a response contract, and check it:

```typescript
interface FlowOutcome {
  status: "ok" | "error"
  message?: string
  reference?: string   // e.g. the order number the other system assigned
}

function parseOutcome(raw: string | undefined): FlowOutcome | null {
  if (!raw?.trim()) return null
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === "object" ? (value as FlowOutcome) : null
  } catch {
    return null
  }
}

export async function closeDealInErp(input: CloseDealInput): Promise<string> {
  const response = unwrap(await CloseDealFlowService.Run({ /* ... */ }), "Close deal")
  // `output` is whatever the flow's "Respond to a Power App or flow" step calls its field.
  const outcome = parseOutcome(response.output)

  if (outcome?.status !== "ok") {
    // No readable outcome is a failure too, not a success.
    throw new Error(outcome?.message || `The flow returned an unreadable result: ${String(response.output ?? "").slice(0, 300)}`)
  }
  return `Closed in ERP as ${outcome.reference}`
}
```

The key line is `outcome?.status !== "ok"`. An earlier version of our production code checked `outcome.status === "error"` instead. When the flow's response couldn't be parsed, `outcome` was `null`, the check was false, and the code went down the **success** path. It marked the order as submitted, with a blank reference number, even though the order had never arrived. **An answer you can't read is not evidence of success.** Fail loudly and let the user retry.

Two more things we learned there:

**Retrying must be safe.** If a false failure makes the user click again, the second call mustn't create a duplicate. Our target system rejected duplicates and returned the existing reference, which made "fail loudly and retry" safe. If yours doesn't, the flow has to check first.

**Record the failure in the same write as the status.** If a failed flow should set the record to "Failed" and store the reason, do both in **one** update, so the two can never disagree. And don't let a failure to *record* the error replace the error itself:

```typescript
await OpportunitiesService.update(id, { new_syncstatus: FAILED, new_syncerror: message.slice(0, 2000) } as any)
  .catch(() => undefined)   // the flow's error is the one the user needs to see
throw new Error(message)
```

(`new_syncstatus` and `new_syncerror` are example custom columns.)

### Changing a flow's contract

When a flow's inputs change, the flow and the app have to agree, and they're deployed separately. The safe order:

1. Add the new input to the flow as **optional**, and make the flow behave as before when it's blank.
2. Deploy the flow. The current app keeps working.
3. Regenerate the service (`pa app add flow`), send the new input from the app, and deploy the app.

A new *required* input breaks every app version that doesn't send it, the moment the flow is saved.

---

## The 120-Second Limit

A flow called from an app must respond within **120 seconds**, or the call fails with a timeout, even though the flow may still be running and may still succeed. That's how you get "it said it failed, but it went through".

If the work can take longer, don't make the app wait for it. Microsoft's [asynchronous flow pattern](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/asychronous-flow-pattern) is the answer:

1. The flow responds straight away: "accepted".
2. It carries on with the slow work.
3. It writes the outcome to a Dataverse row (a status column on the record, or a job table).
4. The app shows "in progress" and refetches that row until it changes.

Your UI treats it like any other long job, which is the next section.

---

## Long-Running Work in the UI

Even under 120 seconds, 20 seconds is a long time to stare at a spinner. And in a React app, **work started by a component normally dies with it**: navigate away and the result has nowhere to go. We ran into this with the order-submission flow. Users started it, moved on to the next record, and never saw whether it worked.

The fix is to move long-running work out of the component and into a **job store**. The demo has one (`src/state/jobs.ts`), built on Zustand, which the starter template already includes:

```typescript
export const useJobs = create<JobsState>((set, get) => {
  const settle = (key: string, status: JobStatus, message?: string) =>
    set((s) => (s.jobs[key] ? { jobs: { ...s.jobs, [key]: { ...s.jobs[key], status, message } } } : s))

  return {
    jobs: {},

    start: (key, label, task) => {
      if (get().jobs[key]?.status === "running") return
      set((s) => ({ jobs: { ...s.jobs, [key]: { key, label, status: "running" } } }))
      task().then(
        (message) => settle(key, "success", message || undefined),
        (error: unknown) => settle(key, "error", error instanceof Error ? error.message : String(error)),
      )
    },
    // dismiss(key) ...
  }
})

export const useIsJobRunning = (key: string) => useJobs((s) => s.jobs[key]?.status === "running")
```

What this buys you:

- **The promise belongs to the store, not a component.** Navigate away, close the detail panel, open another record: the job finishes and reports back.
- **One job per key.** Key jobs by what they act on (`"close:" + opportunityId`). Starting the same key twice is ignored, and any screen can call `useIsJobRunning(key)` to disable its button while the job is in flight, even a screen opened after the job started.
- **Several jobs at once.** A user can start the flow on five records and keep working.

A `JobToasts` component in the layout turns each job into one toast that updates in place: a loading toast while it runs, then success or failure. **Failure toasts stay until dismissed**, because the user may be three screens away when it fails and a 3-second toast would be missed.

The demo uses this for something that doesn't need a flow, so it runs anywhere: **Export CSV** on the dashboard fetches every opportunity (Chapter 7's `fetchAllPages`), builds a CSV and downloads it. Start it, go to Accounts, and the "exported" toast still arrives. Starting a flow is the same call:

```tsx
<Button
  disabled={useIsJobRunning(`close:${opportunityId}`)}
  onClick={() => startJob(`close:${opportunityId}`, `Close ${name} in ERP`, () => closeDealInErp({ ... }))}
>
  Close in ERP
</Button>
```

Our production version went further: a "minimise" button on each toast that collapsed running jobs into a small dock in the corner, and a success toast with a button to open the record the flow created. Add those when users run many jobs at once. The core, work that outlives its page and a status any screen can read, is the part that matters.

> If a job needs React hooks (say, it's written as a TanStack Query `useMutation`), it can't run inside a plain store. In that case, keep the job's data in the store and mount a small runner component per running job at the app root, where it never unmounts. That's how our production app did it. Writing jobs as plain async functions, as the demo does, avoids the extra layer.

---

## Dataverse Actions and Functions

Dataverse has hundreds of built-in operations, and your organization may have its own **custom APIs**. Code Apps can call both:

```bash
pa app find-dataverse-api --search WhoAmI
pa app add dataverse-api --api-name WhoAmI
```

This generates a service per operation. For **bound** actions (ones that act on a record), the first argument is that record's ID.

Two are immediately useful for this series:

- **`WhoAmI`** returns the signed-in user's Dataverse `UserId`, which is their `systemuserid`. That's a shorter path than Chapter 6's lookup through `systemuser.azureactivedirectoryobjectid`.
- **`WinOpportunity` / `LoseOpportunity`** close an opportunity properly, creating the close record Dynamics 365 expects. Setting `statecode` directly doesn't do that.

Custom APIs are also the answer to Chapter 5's aggregation problem: logic that runs next to the data, returns one small result, and can be updated without redeploying the app.

We haven't used `dataverse-api` in production yet. The docs describe the generated types (GUIDs as `string`, table references as `Record<string, unknown>`, results as `IOperationResult<...>`), so check the generated service rather than assuming a shape, and `unwrap` the result like everything else.

---

## Connectors, Called Directly

Any supported connector can be added as a data source. Microsoft's docs use Office 365 Users:

```bash
pa connection create --connector shared_office365users   # or reuse one from `pa connection list`
pa app add data-source --connector shared_office365users --connection-id <connection-id>
```

```typescript
const me = unwrap(await Office365UsersService.MyProfile_V2("id,displayName,jobTitle,userPrincipalName"), "Load profile")
```

Differences from Dataverse:

- **Methods are the connector's operations**, like `MyProfile_V2` or `UserPhoto_V2`, not `getAll`/`create`. The generated service lists them all.
- **Each user needs their own connection.** On first launch the player asks them to create or consent to it. Admins can suppress the consent dialog for some connectors.
- **For ALM, add it through a connection reference** (`--connection-ref ... --solution-id ...`, Chapter 6), not a personal connection ID, or the app is tied to your connection.
- **Excel Online connectors aren't supported.**

---

## Permissions: Why It Works for You and Not for Them

Most flow problems in testing weren't bugs. Check these before you debug:

| Symptom | Usual cause |
|---|---|
| The flow works for the maker, fails for users | Users lack Dataverse permissions to invoke flows. Microsoft suggests the **App Opener** security role or equivalent |
| The flow fails on a step that uses a connection | The flow's connections belong to someone who left, or were never shared; use a service account for flow connections |
| `pa app add flow` fails | You don't have access to the flow or one of its connections |
| A user gets a consent prompt, or "connection not found" | They haven't created their own connection for a directly-called connector |
| Works in Dev, fails in Test | The connection reference in Test has no connection, or a different one |

### Two CLI-era gotchas

We built our production app on the CLI that `pa` replaced. Two problems cost us time there. Both may be fixed in `pa`, but the error messages are worth knowing:

- **`Connection reference not found: <name>`** at runtime after adding a flow. The older CLI wrote the flow's alias into `power.config.json` with a prefix (`_contoso_submitorder`) while the generated service looked it up without one (`contososubmitorder`). The fix was to make the `dataSources` entry in `power.config.json` match the generated service's `dataSourceName`, then restart `npm run dev`, which only reads that file at startup.
- **An HTTP 400 on push mentioning `workflowDetails`.** Flows added with one CLI wrote a block the other CLI's push didn't understand. The lesson generalizes: **use one CLI for everything in a project.** Today that's `pa`.

---

## Key Takeaways

- Three ways to run server logic: flows (multi-step, other systems), Dataverse actions and custom APIs (logic next to the data), connectors (one call, as the user)
- Code Apps call only **solution-aware instant flows with the Power Apps trigger**; regenerate with `pa app add flow` whenever the trigger or response changes
- Wrap each flow in one typed function; generated input names can be positional (`text`, `text_1`, ...). Send structured data with `JSON.stringify`
- **`success: true` means the flow answered, not that it worked.** Give flows a response contract, and treat an unreadable response as a failure
- Make retries safe, and record a failure in the same write as its status
- Change a flow's inputs by adding optional ones first, so the flow can ship before the app
- Flows must respond within 120 seconds; for longer work, respond early and report through Dataverse
- Run long work from a **job store**, keyed by what it acts on, so it survives navigation; keep failure toasts on screen until dismissed
- `WhoAmI` gives you the current `systemuserid`; `WinOpportunity` closes deals properly
- "Works for me" is usually permissions: App Opener role, flow connections, user connections, connection references

---

## What's Next

Chapter 9 covers shipping and supporting the app: version numbers users can report, making sure they're on the latest build, deep links into records, and onboarding testers.

---

*Previous: Chapter 7 - Data at Scale*
*Next: Chapter 9 - Shipping for Real*
