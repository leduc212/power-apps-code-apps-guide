# Chapter 10: Canvas → Code Migration

> **Blog post title:** Rebuilding a Canvas App as a Power Apps Code App: A Migration Playbook
>
> **Audience:** You have a Canvas App that has outgrown Power Fx, and you're considering rebuilding it as a Code App. Or you've been asked to.
>
> **Part 2** is based on a production Code App we implemented to replace a large Canvas App. The patterns are real; the code and examples are rewritten against this repo's demo tables.

---

## Introduction

There is **no converter** from Canvas to Code. Power Fx doesn't carry over, and neither does a single control. A migration is a rewrite of the UI and the logic. What you keep:

- **The Dataverse schema.** Same tables, same columns, same data.
- **The flows and connectors.** The new app calls the same Power Automate flows.
- **The business rules.** Re-expressed in TypeScript, but the same rules.

The app we migrated had tens of thousands of lines of YAML, more than a thousand Power Fx `If`s and hundreds of `UpdateContext` calls. Its two biggest screens were near-copies of each other. This chapter is the method that worked, in the order we'd do it again.

The repo has tools for it:

- **[`tools/measure-canvas-app.mjs`](../tools/)** turns an unpacked Canvas App into an inventory, and finds screens that were copied.
- **[`templates/migration/`](../templates/migration/)** has the three documents the method runs on: a screen spec, a tracker, and a differences log.

---

## 1. Decide Whether It's Worth It

Our reasons, which are the usual ones:

| Driver | In Canvas | In a Code App |
|---|---|---|
| **Paging** | No real paging; collections and `FirstN` workarounds; delegation limits that silently truncate | Server-side paging with a total (Chapter 7) |
| **Performance** | Hundreds of `Collect`s and `UpdateContext`s churning in memory | Explicit, cached, server-paged queries |
| **Maintainability** | Tens of thousands of lines of YAML, only really editable in Studio | Typed code, git diffs, code review, unit tests |
| **Duplication** | Copied screens that drift apart | One parameterised component |

And the honest caveat: **a Code App is more maintainable only for a team that can maintain a React codebase.** If the app will be maintained by makers, if its users need the Power Apps mobile app, or if it works fine and nobody's asking, don't migrate it.

---

## 2. Get the Source, and Pin It

Everything starts from the Canvas app's YAML.

1. **Export the solution** that contains the app (managed or unmanaged, either works for reading).
2. **Unpack the `.msapp`.** It's under `CanvasApps/` in the solution zip, and it's a zip file itself:
   ```bash
   tar -xf <app>.msapp -C app-unpacked
   ```
3. Read `Src/*.pa.yaml` (one file per screen, plus `Components/`) and `References/DataSources.json`. The flows are in the solution's `Workflows/` folder as JSON.

**Pin the version.** The Canvas app won't stand still during the migration: bugs still get fixed and requests still come in. Ours was exported and re-read many times over the project. Record which export every spec was written from, and when a new export arrives, diff the YAML to see which screens changed. The tracker template has a "reference version history" table for exactly this.

**Keep the export in the repo, or somewhere versioned.** "What did Canvas do?" is a question you'll ask weekly, and the answer should be a file, not someone's memory.

---

## 3. Measure Before You Estimate

```bash
node tools/measure-canvas-app.mjs app-unpacked > inventory.md
```

The inventory lists every screen with its size and control count, control types, Power Fx function counts with what each usually becomes, flow calls, Dataverse tables and connectors, and **pairs of screens that were probably copied**. Try it on the included sample:

```bash
node tools/measure-canvas-app.mjs tools/sample-canvas-app
```

What to read from it:

| In the inventory | What it tells you |
|---|---|
| YAML lines per screen | Relative effort. The biggest screen is usually the core of the app and should be built last |
| `UpdateContext` / `Set` counts | How much state you'll untangle. Many context variables turn out to be derived values that shouldn't be stored at all |
| `LookUp` counts | Potential N+1 queries. A `LookUp` inside a gallery becomes one batched query (Chapter 7) |
| `FirstN`, `Collect`, `ClearCollect` | Where Canvas was faking paging or caching. These become paged queries and query keys |
| Flow calls | Each becomes a generated service and needs a response contract (Chapter 8) |
| `Classic/...` controls | Controls users will notice changing. Pick one modern replacement per type |
| Near-duplicate screens | Build once, parameterised (section 6) |

---

## 4. Spike First

Before planning screen by screen, prove the risky parts end to end: **one paged list, one flow call, one deploy.**

Our written plan had a list of open questions (how the paging token comes back, whether every flow was callable as-is, how to replace cross-table `LookUp`s without `$expand`) and a paging hook in the plan document. The spike answered the questions, and showed the planned hook was wrong: it set both `top` and `maxPageSize`, so it could never reach page 2 (Chapter 7 explains why). Finding that in a two-day spike was cheap. Finding it in the fifth screen would not have been.

Write the unknowns down, and spike until each has an answer.

---

## 5. Power Fx → Code

The inventory maps each function to its usual replacement. The ones that need more thought:

| Canvas | Code App | Watch out for |
|---|---|---|
| Gallery on a Dataverse table | Table fed by `usePagedQuery` | Delegation warnings in Canvas meant silent truncation. Server paging is the fix, not a bigger limit |
| `ClearCollect(col, Filter(...))` | `useQuery` with the filter in the query key | The collection was a cache. The query key replaces it, and refetching replaces `Refresh` |
| `UpdateContext({ x })` | `useState` | Many context variables store something derivable (a count, a label, "is anything selected"). Compute those; don't store them |
| `Set(gbl, ...)` | A small global store (Zustand) or context | Most globals were set once in `OnStart` (the user, their role). Those are queries with `staleTime: Infinity` |
| `LookUp(T, id = x)` | `get(id)`, or `getAll({ filter, top: 1 })` | Inside a gallery it's one request per row. Use `formattedValue` for names, `fetchByIds` for anything else |
| `Patch(T, rec, { ... })` | `update(id, changes)` | Send only changed fields. `Patch` with a whole record is a habit worth breaking |
| `Remove` / `RemoveIf` | `delete` / query IDs, then delete each | `RemoveIf` over many rows may belong in a custom API |
| `MyFlow.Run(...)` | Generated service, wrapped in a typed function, run as a job | The Canvas screen may do work *after* the flow returns (section 11) |
| `Concurrent(a, b)` | `Promise.all([a, b])` | |
| `Notify(msg, Error)` | A toast | Failures on long jobs need toasts that stay (Chapter 8) |
| `IfError(...)` / `Errors(...)` | `try`/`catch`, and `unwrap()` on every call | Canvas often ignored errors silently. Decide what the user should see |
| `Navigate(Screen, ...)` | `navigate("/route")` | Screens become routes, so they get URLs and deep links (Chapter 9) |
| Option set comparisons | `Number(x.statecode) === 0`, labels from `formattedValue` | |
| `If` / `Switch` chains in properties | Plain conditionals, or a lookup map | Visibility and `DisplayMode` conditions are business rules. Put them in the spec exactly |

---

## 6. Merge Duplicate Screens

The inventory flagged our two biggest screens as near-duplicates. Canvas makes copying a screen the easiest way to support a second region, a second team or a second process, and then the copies drift.

Compare the two screens with control names ignored:

```bash
node tools/measure-canvas-app.mjs app-unpacked --diff OpportunitiesNorth OpportunitiesSouth
```

On the included sample, what's left is:

```
Only in OpportunitiesNorth:
  Filter(Opportunities, ... && Region = "North")
  Text: =... & " - Opportunities (North)"
  DisplayMode: =If(IsBlank(locSelected), DisplayMode.Disabled, DisplayMode.Edit)

Only in OpportunitiesSouth:
  Filter(Opportunities, ... && Region = "South")
  Text: =... & " - Opportunities (South)"
```

Two kinds of difference appear, and they need different treatment:

**Parameters.** The region value and the title differ on purpose. They become configuration, and the screen is built once:

```typescript
const REGIONS = {
  north: { label: "North", filterValue: "North" },
  south: { label: "South", filterValue: "South" },
} as const

// route: /opportunities/:region
```

**Drift.** The North screen's Delete button isn't restricted to managers, and the South one is. Nobody decided that; one copy got a fix and the other didn't. Drift is a question for the business ("should everyone be able to delete in North?"), and the answer goes in the differences log (section 10).

On our real screens, a plain diff of the two files was about 2,600 lines, almost all renamed controls. With names ignored, about 500 lines were left to review: a list of real decisions, not noise. The merged screen now serves every region from one component.

---

## 7. Migration Order

1. **The smallest screens first.** They prove the shell, the navigation, sign-in, the theme and a deploy, with little logic to get wrong.
2. **Shared components.** Header, navigation, the paged table, dialogs.
3. **CRUD screens** (admin, configuration). Good practice for the data layer, with simple rules.
4. **The core screen last, in slices.** It's the biggest and the one users care about. By now the patterns are settled. Slice it: the list, then read-only detail, then editing, then each action.

---

## 8. One Screen at a Time: Spec, Build, Check

Every screen, and every slice of a big one, goes through the same loop:

```
Spec → confirm → build → type-check → parity check against live Canvas → tests → commit
```

**The spec comes first.** [`templates/migration/SCREEN_SPEC.md`](../templates/migration/SCREEN_SPEC.md) captures everything the Canvas screen does: data read and written, flows called, state, every control's behaviour, the business rules exactly, and a parity checklist. It's the acceptance contract for the slice. Reading a 3,000-line YAML file and writing down what it does is also the part an AI coding agent is best at (Chapter 11), as long as a person confirms the result.

The spec catches the behaviours that would otherwise be lost: a button that's disabled for one role, a default applied only when a field is blank, a message worded a particular way because users complained about the previous one.

**Tests** go on the pure functions the spec identifies: validators, calculations, mappers. Pull them out of the components so they can be tested. This is something Canvas never let you do, and it pays for itself the first time a rule changes.

---

## 9. Parity Is the Bottleneck

A parity check means opening the Canvas app and the Code App side by side, **on the same records**, and walking the spec's checklist: every field, every action, every message, every role.

Both apps read the same Dataverse, so side-by-side is easy to set up. It still takes a person who knows the app, and their time is the scarcest resource in the project. In our tracker, the most common status by far was **"built, awaiting live parity"**. Writing code with an AI agent was rarely the bottleneck. Reviewing it against reality always was.

So:

- **Schedule parity sessions** like any other dependency. Don't wait for someone to have a free afternoon.
- **Keep the status honest.** "Built" is not "done". The tracker template has a separate column for parity for this reason.
- **Use known records.** Pick a few records per screen that cover the edge cases, and check those every time.

---

## 10. The Differences Log

Some differences are deliberate: paging where Canvas had none, a better control, a fixed bug. Log every one in [`templates/migration/DIFFERENCES.md`](../templates/migration/DIFFERENCES.md): what Canvas did, what the Code App does, why, and who agreed. Without it, every parity reviewer reports the same improvements as regressions, and a year later nobody knows whether a behaviour is a bug or a decision.

**Translating code carefully finds bugs.** One of ours: a profile screen showed the manager's email under "Manager Name" and the manager's name under "Manager Email". Nobody had noticed in the Canvas app. **Ask before fixing** a Canvas bug. Occasionally someone depends on it, and either way the decision belongs in the log.

Our log grew past a hundred rows. That isn't scope creep; it's the record of every decision that would otherwise be rediscovered in an argument.

---

## 11. What Canvas Hid

Some behaviour isn't where you'd expect it:

- **Logic in the app that looks like it's in the flow.** One of our submission flows didn't update the record's status. The Canvas screen did that itself, *after* the flow returned. Port only the flow call, and records never change status. For every flow call, read both the flow definition and the screen code around the `.Run(`.
- **`OnStart` and `OnVisible`.** Globals set at start-up and collections loaded when a screen opens are easy to miss, because they aren't attached to a control.
- **Delegation limits.** A non-delegable `Filter` silently used the first 500 (or 2,000) rows. The Canvas app's "correct" numbers may have been wrong all along. Say so in the differences log when the Code App's totals don't match.
- **Implicit defaults.** `DelayOutput` on a text input (a debounce), `Default` on a control that's really a business rule, a formatting string in a label's `Text`.

---

## 12. Keep It Familiar

Users switching from the Canvas app shouldn't have to relearn it on day one. Our rules:

- **Mirror the layout.** Same header, same navigation, same section order, same field positions. Rebuild from the YAML, not from memory.
- **Match the colours exactly**, from a theme file, never hard-coded.
- **Upgrade controls freely.** The Classic controls were no one's favourite. A better date picker or data grid in the same place is welcome.
- **Log behaviour changes**, not just visual ones, in the differences log.

---

## 13. Schema Changes During the Migration

The schema won't stand still either: a new column for a new feature, a changed choice value.

- **Regenerate after every change** (`pa app refresh data-source`). In our app, a column added in Dataverse came back empty in the Code App until we regenerated. The query looked right, and the value was simply missing.
- **Review generated diffs before committing.** `src/generated/` is machine-written, but it's still code your app depends on. Once, on the older CLI, re-adding one table also rewrote every flow service with a different method signature. Git caught it; nobody had asked for it.

---

## 14. Cutover

Because both apps use the same Dataverse, you don't need a big-bang switch. Run them side by side, move users over team by team, and retire the Canvas app when nobody opens it.

While both are live, **they must agree on the data.** If the Code App writes a status value the Canvas app doesn't recognise, or the Canvas app skips a column the Code App now relies on, one of them breaks the other's records. Keep a short list of the values and columns both apps write, and check it at every release until the Canvas app is gone.

Then:

- Move the app's connections to **connection references** and deploy through a solution (Chapter 6).
- Share the app and onboard users (Chapter 9).
- Keep the final Canvas export. You'll still be asked what the old app did.

---

## 15. Beyond Parity

Once the Code App matches, it can do things Canvas couldn't. Ours gained a reporting screen that never existed in Canvas, and could never have been built there at a usable speed. Keep new features **out of the parity scope**: log them as differences, spec them separately, and don't let them delay the switch.

---

## Key Takeaways

- There's no converter: keep the schema, flows and rules; rewrite the UI and logic
- Migrate only if a team can own a React codebase, and users don't need the Power Apps mobile app
- Pin the Canvas export every spec comes from; the Canvas app will change while you migrate
- **Measure** with `tools/measure-canvas-app.mjs`; **spike** the risky parts before planning
- Most `UpdateContext`s are derived values; most collections are caches; most `LookUp`s in galleries are N+1 queries
- Diff copied screens with control names ignored: what's left is **parameters** (config) and **drift** (decisions)
- Small screens first, the core screen last and in slices
- Spec → confirm → build → parity → tests → commit. **Parity checks are the bottleneck; schedule them**
- Log every intentional difference, and ask before fixing Canvas bugs
- Look for logic Canvas hid: status updates after flows, `OnStart`, delegation truncation
- Regenerate after schema changes and review generated diffs
- Cut over gradually; while both apps are live, they must agree on the data

---

## What's Next

Chapter 11 covers the other half of how we built this: working with an AI coding agent, from the project rules that kept it honest to the specs that made its output reviewable.

---

*Previous: Chapter 9 - Shipping for Real*
*Next: Chapter 11 - Building with an AI Coding Agent*
