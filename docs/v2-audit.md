# v2 Audit: What Changed Between Feb 2026 and Sep 2026

Working checklist for the v2 restructure. Every claim in the v1 README and chapters is marked with what to do with it, why, and where the fix lands in v2. The original text is frozen at tag `v1-feb-2026`.

**Audited:** 2026-09-28

## Legend

| Verdict | Meaning |
|---|---|
| **Keep** | Still true. Carry into v2 as is (light edits only). |
| **Update** | The idea is right but the detail changed. Rewrite. |
| **Wrong** | Was wrong or is now false. Replace. |
| **Verify** | Evidence conflicts or is missing. Test live before v2 says anything. |
| **Remove** | No longer useful. Drop. |

| Evidence | Source |
|---|---|
| **[D]** | Microsoft Learn code-apps docs, pages dated Aug-Sep 2026 |
| **[P]** | A production Code App we implemented (a Canvas → Code migration, Jun-Sep 2026), generalised. No client specifics. |
| **[S]** | `@microsoft/power-apps` SDK source (1.2.5 in the production app, 1.4.0 in the demo) and the demo's generated files |
| **[N]** | npm registry, 2026-09-28 |

---

## Headline changes (the reasons v2 exists)

1. **The CLI changed twice.** Feb: `pac code` + `npx power-apps`. The production app (Jul): `npx power-apps` v0.12 for flows and push, `pac` still needed for Dataverse. Now **[D]**: a single global CLI, `pa`, installed with `npm i -g @microsoft/power-apps-cli`, with grouped commands (`pa app ...`, `pa auth ...`, `pa connection ...`). `pac` is no longer listed as a prerequisite. **Every command in v1 needs rewriting.**
2. **SDK moved from `^1.0.4` to 1.4.0** **[N]**. `@microsoft/power-apps-vite` is 1.0.13. Even the production app (1.2.5) is behind.
3. **Several "limitations" are gone** **[D]**: schema refresh (`pa app refresh data-source`), creating connections from the CLI (`pa connection create`), sharing from the CLI (`pa app share`), non-interactive push with a service principal (CI/CD), external users via Azure B2B, and licensing that is no longer Premium-only.
4. **The v1 demo code has a silent-failure bug** **[S][P]**: generated services **resolve** with `{ success: false, error }` and do not throw. `result.data ?? []` turns a failed query into an empty list, and TanStack Query's `isError` never fires. Every v1 query snippet has this bug.
5. **The v1 guidance on option-set labels is backwards** **[P][D]**: display labels arrive as `@OData.Community.Display.V1.FormattedValue` annotations on every read. The generated `*name` props (`statecodename`, `createdbyname`) are **not populated**. Mapping labels by hand is unnecessary.

### Caveat on production-app evidence

The production app was built on the **previous** CLI (`npx power-apps` v0.12 + `pac` 2.7/2.9). Three of its hard-won gotchas may be fixed in `pa` and must be re-tested before v2 teaches them:

- `pac code push` HTTP 400 on `workflowDetails` (possibly moot now that `pac code` is out of the flow)
- The flow connection-reference alias mismatch (`_contoso_submitorder` vs `contososubmitorder`)
- `pac code delete-data-source` crashing on Windows (moot if `pa app refresh data-source` works)

---

## README.md

| # | v1 claim | Verdict | Evidence / correction | v2 home |
|---|---|---|---|---|
| R1 | "GA date: February 5, 2026" | Keep | Historical fact. | README |
| R2 | Prerequisites: Node, **PAC CLI**, environment, Premium | Update | **[D]** Node LTS, Git, `pa` CLI. No `pac`. | Ch 2 |
| R3 | Enable code apps: Admin center > Environments > Settings > Product > Features | Keep | **[D]** Same path. Add: can be set at scale with environment groups and rules. | Ch 2 |
| R4 | "Premium required ... No per-app licensing path" (~$20/user/mo) | **Wrong** | **[D]** Premium **or** pay-as-you-go **or** App Pass **or** auto-claim. The cost argument in "Our Take" needs redoing. | Ch 1, README |
| R5 | Running the demo: `npx power-apps init` + `pac code add-data-source` | Update | `pa app init`, `pa app add data-source --connector dataverse --table <name>`. | README |
| G1 | `npm run dev` is the only command you need (with the starter template's plugin) | Verify | **[D]** The quickstart now uses `templates/vite` + `pa app run`, while the data page still says `npm run dev`. Check whether the vite template ships the plugin and whether `starter` still exists. | Ch 2 |
| G2 | Open the Local Play URL, not localhost | Keep | **[D][P]** Still true. | Ch 2 |
| G3 | Browser blocks localhost (local network access) | Keep | **[D]** Still documented. Add: embedded iframes need `allow="local-network-access"`. | Ch 2 |
| G4 | Same browser profile as the tenant | Keep | **[D]** Still documented. | Ch 2 |
| G5 | `statecode` typed `string`, arrives as `number` | Verify | Re-check against SDK 1.4.0 generated models. Keep the `Number()` advice if still true. | Ch 3 |
| G6 | Don't `$select` `statecodename`; "it's returned automatically" | **Wrong** (half) | The 400 on selecting it is right. But it is **not** returned: the `*name` props stay empty **[P]**. Read `field@OData.Community.Display.V1.FormattedValue` instead. **[D]** now lists "retrieve formatted values (labels)" as supported. | Ch 3 |
| G7 | Decimal/currency typed `string`, must send `number` | Verify | Re-check on 1.4.0. | Ch 4 |
| G8 | Polymorphic lookup via `customerid_account@odata.bind` works | **Verify** | **[D]** lists polymorphic lookups as **not supported**. v1 reports it worked on create. It may work as a pass-through while being officially unsupported. Test live, then say exactly which. | Ch 4 |
| G9 | Writes need `as any` | Update | **[D]** shows `as Omit<Accounts, 'accountid'>`. Teach a typed payload helper and keep `as any` as a last resort. | Ch 4 |
| G10 | `objectId` ≠ `systemuserid` | Keep | Still true. | Ch 6 |
| G11 | No schema refresh command | **Wrong** | **[D]** `pa app refresh data-source --name <ds>`. | Ch 3 |
| G12 | You cannot create connections via CLI | **Wrong** | **[D]** `pa connection create --connector <id>`. | Ch 3, Ch 8 |
| G13 | Compiled bundle is publicly readable; no secrets in client code | Keep | **[D]** Still documented. Add: restrict by IP through Entra Conditional Access, not SAS IP binding. | Ch 9 |
| G14 | Two CLIs; npm CLI replacing `pac code` | **Wrong** | Replaced by `pa`. Rewrite as a short "history of the CLI" note so old tutorials make sense. | Ch 2 |
| C1 | Comparison table: Code App mobile ❌ "browser only" | Verify | **[D]** The limitations list now names only Power Apps **for Windows**. `pa app init --app-type MobileApp` exists, and "native mobile apps (preview)" is a separate doc. A community request for mobile play is still open. Research before claiming either way. | Ch 1 |
| C2 | Comparison table: external users ❌ "internal Entra only" | **Wrong** | **[D]** Azure B2B guest access supported, same as canvas. | Ch 1 |
| C3 | Comparison table: License "Premium required for all users" | **Wrong** | See R4. | Ch 1 |
| C4 | Comparison table: no Power Platform Git integration | Keep | **[D]** Still unsupported. | Ch 1 |
| C5 | Comparison table is missing newer app types | Update | Newer app types (e.g. "Vibe Apps") are now discussed. Research and add a row if it's real. | Ch 1 |
| L1 | Limitations: no Power BI integration, no SharePoint forms, no SAS IP | Keep | **[D]** Still listed. | Ch 1 |
| L2 | Limitations: Excel Online not supported | Keep | **[D]** Still listed on the data page. | Ch 3 |
| L3 | Limitations list is missing Secure Implicit Connections | Update | **[D]** New entry: not yet supported. | Ch 1 |
| L4 | Limitations list has no managed-platform support table | Update | **[D]** Add: consent dialogs, quarantine, per-app Conditional Access, tenant isolation, health metrics. | Ch 1 |
| T1 | "Our Take": GA'd less than six months ago; lifecycle risk because both CLIs are shifting | Update | Rewrite with hindsight: the CLI churned again (a real cost), but the platform grew instead of shrinking. | README |
| T2 | "Our Take": licensing math is brutal | Update | Soften per R4. Keep the "do the math" advice. | README |

---

## Chapter 1: Paradigm

| # | v1 claim | Verdict | Note |
|---|---|---|---|
| 1.1 | Code Apps = standard SPA + SDK + host; three-layer diagram | Keep | Still the right mental model. |
| 1.2 | Step 3 of the flow: use the **Power Platform CLI** to add data sources | Update | `pa`. |
| 1.3 | Table "What the platform gives you" | Update | Add sharing via `pa app share` and the managed-platform table (L4). Fix the licensing row (R4). |
| 1.4 | Not PCF / not an Azure app / not canvas-with-code | Keep | |
| 1.5 | Decision framework | Update | Fold in C1-C3. Add an explicit "migrating from canvas" branch that links to the new migration chapter. |

## Chapter 2: Hello World

| # | v1 claim | Verdict | Note |
|---|---|---|---|
| 2.1 | Two CLIs section | **Remove** | Replace with the `pa` setup and a short history box (G14). |
| 2.2 | Scaffold with `templates/starter` | Verify | **[D]** The quickstart uses `templates/vite`. Check which templates exist today. |
| 2.3 | `npm install @microsoft/power-apps` + `npx power-apps init` | Update | **[D]** `npm i -g @microsoft/power-apps-cli`, then `pa app init --display-name ... --environment-id ...`. |
| 2.4 | "Do not edit `power.config.json` manually" | Update | **[P]** Mostly right, but there were documented cases where hand edits were required (flow alias fix). `pa app set-setting` now writes `appSettings` into it. Reframe as "CLI-owned; edit only for a known fix". |
| 2.5 | Local Play URL, local network access, same profile | Keep | G2-G4. |
| 2.6 | `npm run build` + `npx power-apps push` | Update | `pa app push`. |
| 2.7 | "Build + push" note about `npm run build \| pac code push` | Remove | Obsolete. |
| 2.8 | New: hide the Power Apps header | Add | **[D]** `pa app set-setting --show-header false` or `?hideNavBar=true`. |
| 2.9 | New: the starter template lags the library | Add | **[D]** On 2026-09-28 `templates/starter/package.json` still asks for `@microsoft/power-apps` `^1.2.5` and `power-apps-vite` `^1.0.2`, while 1.4.0 / 1.0.13 are current. Ch 2 tells readers to install `@latest` right after scaffolding. |

## Chapter 3: Dataverse

| # | v1 claim | Verdict | Note |
|---|---|---|---|
| 3.1 | `pac auth create` / `pac env select` / `pac code add-data-source` | Update | `pa app add data-source --connector dataverse --table <logical-name>`. **[P]** Note that `--table` takes the **logical** name, which can be singular even when the entity set is plural. Check the entity metadata. |
| 3.2 | Hard-coded environment GUID in the `pac env select` example | **Remove** | Real environment ID committed to a public doc. Replace with a placeholder. |
| 3.3 | "Regenerated every time you add or remove a data source" | Update | Plus `pa app refresh data-source`. |
| 3.4 | Option sets: `Number()` compare; map labels manually | **Wrong** (half) | Keep `Number()` if G5 holds. Replace manual label mapping with FormattedValue annotations (G6). |
| 3.5 | Service returns `{ data }` | **Wrong** | Returns `IOperationResult`: `{ success, data, error, skipToken? }` **[S]**. Teach checking `success` and throwing. |
| 3.6 | `getAll` options include `skip` | Update | Paging is by `skipToken` + `maxPageSize` **[P]**. Explain `top` vs `maxPageSize`, and that a bare `getAll` returns **only the first page** **[P]**. **[S]** The client library sends `maxPageSize` as a `Prefer: odata.maxpagesize` header, **defaulting to 500**. `skip` becomes `$skip`, which the Dataverse Web API doesn't support. (Ch 3 first said "up to 5,000"; corrected 2026-09-28.) |
| 3.7 | Accounts page: `contains(name, '${search}')` | **Wrong** | OData injection / breaks on apostrophes ("O'Brien"). Escape `'` as `''` **[P]**. |
| 3.8 | `useDeferredValue` "achieves the same result" as debounce | **Wrong** | It defers rendering, not requests. Fast typing still fires a query per settled keystroke. Use a real debounce. |
| 3.9 | `result.data ?? []` in `queryFn` | **Wrong** | Headline #4. |
| 3.10 | `createBrowserRouter` with the `BASENAME` hack | Verify | **[P]** used `createHashRouter`. The app is served from a time-stamped storage-proxy URL inside the player iframe, so path routes don't survive as shareable links. Decide on a recommended router and explain why. |
| 3.11 | Runtime call path diagram | Keep | |

## Chapter 4: CRUD

| # | v1 claim | Verdict | Note |
|---|---|---|---|
| 4.1 | Parallel `useQuery`, `enabled: !!id` | Keep | |
| 4.2 | Filter related rows by `_x_value eq id` | Keep | |
| 4.3 | Polymorphic bind `customerid_account@odata.bind` | **Verify** | G8. |
| 4.4 | "PascalCase not recognised — navigation properties are lowercase" | **Wrong** | The bind key is the **navigation property name**, which is case-sensitive and often mixed case on custom tables (e.g. `new_ParentOrder@odata.bind`) **[P]**. What failed in v1 was the wrong property name, not its case. **Root cause found 2026-09-28 [S]:** the generated `OpportunitiesBase` declares bind keys built from lookup *schema names* (`"ParentAccountId@odata.bind"`), which on system tables differ from the navigation property (`parentaccountid`). v1 used the generated key. On custom tables the two usually match, which is why the production app's binds worked. |
| 4.5 | Section "`customerid` and `customeridtype` — the SDK requires both" | **Remove** | Contradicts the table above it in the same chapter, which says they don't work. Leftover draft text. |
| 4.6 | `as any` on create | Update | G9. |
| 4.7 | Numeric fields sent as `number` | Verify | G7. |
| 4.8 | Update: send only changed fields | Add | **[D]** Sending unchanged fields triggers business logic and pollutes the audit log. v1 doesn't cover update at all. |
| 4.9 | Delete + `invalidateQueries` | Keep | But check `success` (headline #4). |
| 4.10 | (new finding) Delete failures | Add | **[S]** The generated `delete()` (from the Feb generator) is typed `Promise<void>` and **drops the SDK result**, so a failed delete can't be detected from app code. Re-check after regenerating with `pa`. If the new generator still does this, teach it as a gotcha. |

## Chapter 5: Dashboard

| # | v1 claim | Verdict | Note |
|---|---|---|---|
| 5.1 | "recharts is in `templates/vite`" | **Wrong** | Ch 2 used `starter`. Re-check after 2.2. |
| 5.2 | One query with `top: 500` | Update | Show a `fetchAllPages` helper that walks `skipToken` with a safety cap **[P]**. `top: 500` silently truncates. |
| 5.3 | "`$apply` ... Chapter 6 touches on this" | **Wrong** | Ch 6 never does. Either cover aggregation (Dataverse actions/functions via `pa app add dataverse-api` may be a route; verify) or remove the promise. |
| 5.4 | recharts `fill` can't use CSS variables | Verify | Modern browsers resolve `var()` in SVG presentation attributes set via `style`. Re-test; the claim may be too broad. |
| 5.5 | `ResponsiveContainer`, `Cell`, skeletons, `fmt` | Keep | |

## Chapter 6: Context and ALM

| # | v1 claim | Verdict | Note |
|---|---|---|---|
| 6.1 | `getContext()` from `@microsoft/power-apps/app`, wrap in `useQuery` | Update | **[P]** Guard with a timeout: it can hang when there's no host bridge. |
| 6.2 | During local dev, user fields are undefined | Verify | Untested claim. |
| 6.2b | `IContext` shape | Update | **[S]** 1.4.0 adds `app.dataverseOrgUrl` and `app.appUrl` (both optional; hosts may leave them unset). |
| 6.3 | `objectId` → `systemuserid` via `systemuser` | Keep | |
| 6.4 | `npx power-apps push --solutionUniqueName` | **Wrong** | **[D]** `pa app push --solution-id <id>` (find the ID with `pa solution list`). |
| 6.5 | `pac solution export/import` flow | Keep | Still valid for manual ALM. |
| 6.6 | `pac pipeline run --name ... --stageOrder 1` | **Wrong** | **[D]** No such command. It's `pac pipeline deploy --solutionName <s> --stageId <id> --currentVersion <v> --newVersion <v> [--wait]`; get the stage ID from `pac pipeline list --pipeline <name>`. |
| 6.7 | Environment variables: "read them via `context.app.appSettings`" | **Wrong** | `appSettings` holds player settings such as `showHeader` **[D]**. In code apps, environment variables parameterise **data sources** (`--dataset "@envvar:<schema>"` on `pa app add data-source`) **[D]**. The SDK has no runtime API for reading a value; to read one in app code, query the `environmentvariabledefinition` and `environmentvariablevalue` tables (definition by schema name → current value → fall back to the default) **[P]**. |
| 6.8 | Connection references for ALM | Update | **[D]** `pa app add data-source --connection-ref <name> --solution-id <id>` binds to a reference from the start. This is the core of multi-environment ALM and v1 doesn't mention it. |
| 6.9 | "Production-ready" framing | Update | Moves to Part 2. What production actually needed is in Ch 7-9. |
| 6.10 | New: deep links | Add | **[P]** The player URL carries custom query params into `getContext().app.queryParams`. Validate the route param (single leading `/`) so it can't be used as an open redirect. |
| 6.11 | New: CI/CD | Add | **[D]** `pa app push --non-interactive` with a service principal. Share with the Enterprise Application object ID, not the App Registration. |

---

## New material for Part 2 (from the production app, generalised)

Each item is a pattern, not client code. Rewrite against the CRM demo's standard tables.

| Chapter | Topic | Source |
|---|---|---|
| 7 Data at scale | `usePagedTable`: skipToken token stack for back/forward, 25 per page, `keepPreviousData` | [P] |
| 7 | Total counts. **SDK 1.4.0 adds `count: true`**, which returns `result.count` from `@odata.count`, **capped at 5,000** by Dataverse **[S]**. The production app's id-only walk (built when the SDK dropped the count) is now only needed above 5,000 rows. Teach `count: true` first and the walk as the fallback. | [S][P] |
| 7 | `fetchAllPages` for small lists that must be complete | [P] |
| 7 | Joins without `$expand`: multiple queries, or FormattedValue for display-only lookups | [P][D] |
| 7 | OData escaping helper; always `select` | [P][D] |
| 8 Flows and connectors | `pa app list-flows` / `pa app add flow`; only solution-aware, Power Apps-triggered flows | [D][P] |
| 8 | UI for long-running flow jobs: a job store, a toast with minimise, a dock | [P] |
| 8 | Dataverse custom actions/functions via `pa app add dataverse-api` (new; not used in the production app) | [D] |
| 8 | Gotchas to re-test on `pa`: alias mismatch, `workflowDetails` | [P] |
| 9 Shipping | Version from `package.json` injected as `__APP_VERSION__` / `__BUILD_DATE__`; a version gate that forces reload on stale bundles | [P] |
| 9 | Environment banner driven by an environment variable | [P] |
| 9 | Sharing checklist: app share + security role + flow run-only + connections + the app's own user table | [P][D] |
| 9 | Troubleshooting table (wrong account, stale config needs a dev-server restart, tester permission errors) | [P] |
| 10 Canvas → Code | Measure first: count screens, controls and Power Fx calls from the unpacked `.msapp` | [P] |
| 10 | Power Fx → TS mapping (`UpdateContext`→state, `Set`→store, `Collect`→query cache, `Concurrent`→`Promise.all`, `Patch`→`create`/`update`) | [P] |
| 10 | Merge near-duplicate screens into one parameterised screen | [P] |
| 10 | `DIFFERENCES.md` log + parity tracker; verify behaviour against the exported solution, not memory | [P] |
| 10 | Dataverse-side traps: the canvas app hid logic that must now live in flows | [P] |
| 11 AI agent workflow | `CLAUDE.md` hard rules (never edit `generated/`, check SDK calls against generated services, always `select`, humans run interactive logins) | [P] |
| 11 | `specs/_TEMPLATE.md`; plan in the spec before touching app code; one commit per screen | [P] |
| 11 | Official agent tooling now exists (code-apps plugin/skills); compare with a hand-written CLAUDE.md | research |

## Confidentiality rule for Part 2

Nothing from the production app is copied verbatim. Strip the client name, brand colours, table prefixes, flow names and GUIDs, environment URLs, accounts, and business rules. Re-derive every code sample against `account` / `contact` / `opportunity`. Its codebase is a source of *lessons*, not text.

---

## Resolution without a live environment (2026-09-28)

The author decided not to run the demo against an environment for v2. Each open item was closed by research where possible. The rest are written into the chapters with an explicit caveat instead of being asserted as fact.

| Item | Resolution |
|---|---|
| G1 / 2.2 templates | **Resolved [D]**: `templates/starter` still exists, is still "recommended", and its `vite.config.ts` still includes `powerApps()`. `npm run dev` stays the one command. The Learn quickstart uses the minimal `vite` template with `pa app run`. |
| C1 mobile | **Resolved [D]**: code apps still don't run in the Power Apps mobile app (open request, discussion #286). "Native mobile apps" is a separate preview (React Native/Expo, built through an agent plugin). The CLI's `--app-type MobileApp` appears to belong to that preview; not confirmed, so the guide only points to it. |
| 6.6 pipelines | **Resolved [D]**: see the table above. |
| 6.7 env vars | **Resolved [D][P]**: see the table above. |
| G6 labels | **Resolved [P][D]**: the demo reads `@OData.Community.Display.V1.FormattedValue` through `formattedValue()`, falling back to the local label map, so it renders either way. |
| G5 / G7 numeric types | **Caveat**: keep `Number()` everywhere; it's correct whether the value arrives as a string or a number. The chapters present the type mismatch as observed on the Feb generator. |
| G8 polymorphic bind | **Caveat**: the Feb demo created opportunities with `customerid_account@odata.bind`; the Aug docs list polymorphic lookups as unsupported. The chapter shows the code that worked, says both things, and names the non-polymorphic `parentaccountid` lookup as the fallback. |
| 3.10 router | **Caveat**: the demo keeps the template's browser router with its `BASENAME` fix. Deep links go through `getContext().app.queryParams`, which works with either router (Ch 9). |
| 5.4 CSS vars in SVG | **Caveat**: softened to "use explicit colours for chart fills". |
| 6.2 local context | **Caveat**: the chapter guards for missing user fields without claiming what local play returns. |
| 4.10 delete result | **Open**: stays a documented gotcha until someone regenerates with `pa`. |
| CLI gotcha (new) | **Observed 2026-09-28**: when `pa app add data-source` prompts for the organization URL, it must include `https://`. Without it the CLI builds the scope `<host>//.default` and sign-in fails with AADSTS70011. Run `pa app init` first so the environment is known. |

### Original verification list (kept for anyone with a live environment)

Run these on SDK 1.4.0 + `pa` before writing the affected chapters. The demo app was upgraded on 2026-09-28 (see the upgrade log below) and is the test app for all of them.

- [ ] Regenerate `src/generated/` with `pa app add data-source` and diff against the Feb output: does `IGetAllOptions` gain `count`, does `delete()` return the result (4.10), do option-set and decimal types change (G5/G7)?

- [ ] G1 / 2.2: which templates exist; does the vite template include the plugin; `npm run dev` vs `pa app run`
- [ ] G5 / G7: option-set and decimal runtime types on 1.4.0
- [ ] G8 / 4.3: polymorphic `customerid_account@odata.bind` on create
- [ ] 3.10: browser router vs hash router inside the player (reload + share link)
- [ ] 5.4: CSS variables in recharts fills
- [ ] 6.2: `getContext()` user fields in local play
- [ ] 6.6: `pac pipeline run` syntax
- [ ] 6.7: how environment variables surface on `pa` / SDK 1.4.0
- [ ] C1: mobile / `--app-type MobileApp` status
- [ ] Production-app caveat: alias mismatch and `workflowDetails` on `pa`

## Demo upgrade log (2026-09-28)

`crm-sales-hub` moved to the current toolchain. Verified: `npm run build` passes and lint is clean on changed files (the 3 pre-existing shadcn `react-refresh` lint errors are unchanged). **Not yet run against a live environment.**

| Change | Audit item |
|---|---|
| `@microsoft/power-apps` 1.0.4 → 1.4.0, `@microsoft/power-apps-vite` 1.0.2 → 1.0.13; built unchanged with the Feb-generated services | headline #2 |
| `src/lib/dataverse.ts`: `unwrap()` throws on `success: false`; every query and the create mutation use it | headline #4, 3.9 |
| Error states added to the dashboard and account detail pages; create/delete failures show a toast | headline #4 |
| `odataString()` escapes the search filter | 3.7 |
| `useDebouncedValue` replaces `useDeferredValue` for search | 3.8 |
| `getContext()` wrapped in a 3 s timeout | 6.1 |
| Demo README rewritten for `pa` (setup, regenerate, run, push, refresh); `.gitignore` note and `power.config.json.example` point at `pa app init`; package renamed `crm-sales-hub` | 2.3, 2.6, G11 |
| `pa` CLI confirmed working: `@microsoft/power-apps-cli` 1.0.2 runs through `npx` with no global install; `pa app refresh data-source` without `--name` refreshes all | G11, G14 |

Deliberately **not** changed yet (waiting on live verification): the polymorphic bind and `as any` on create (G8/G9), option-set label mapping vs FormattedValue (G6), the browser router (3.10), and the dashboard's `top: 500` (moves to Ch 7 with `fetchAllPages`/`count`).

## Chapter 7 log (2026-09-28)

Written: [learnings/chapter-7-data-at-scale.md](../learnings/chapter-7-data-at-scale.md). Demo changes:

| Change | Notes |
|---|---|
| `src/lib/paging.ts`: `ListOptions` (adds `count` for pre-1.4 generated types), `fetchAllPages` (5,000 per request, **throws** past `maxRows` instead of truncating), `fetchByIds` (de-duplicated, GUID-checked, 50 IDs per `or` filter, batches in parallel) | Checked with a throwaway script against a fake cursor-paging `getAll`: 12,345 rows in 3 requests; the cap throws; 120 IDs (+ duplicates and junk) → 3 batched requests; `success: false` surfaces as an error. Not run against Dataverse. |
| `src/hooks/usePagedQuery.ts`: token stack, render-time reset on filter change, `keepPreviousData`, `count: true` with a 5,000 cap flag | |
| `src/components/pager.tsx` | "1-25 of 1,204 accounts", "5,000+" at the cap |
| Accounts page: `top: 50` → 25 per page with total; `orderBy` ends with `accountid` | |
| Dashboard: `top: 500` → `fetchAllPages`; new "Top Open Deals" table (account name from FormattedValue, city from `fetchByIds`) | `src/pages/dashboard-top-deals.tsx` |

Taught in prose only (not in the demo): counting past 5,000 with an ID-only walk, the chunked cursor seek for page-number jumps, and `useInfiniteQuery` pickers.

Unverified against a live environment: that `@odata.count` comes back alongside `odata.maxpagesize` paging on every page (the SDK passes it through when present), and that Dataverse keeps `skipToken` paging stable with a primary-key tiebreaker in `orderBy` (standard Web API behaviour).

## Chapter 8 log (2026-09-28)

Written: [learnings/chapter-8-flows-and-connectors.md](../learnings/chapter-8-flows-and-connectors.md).

**Sources checked [D]:** [Add Power Automate flows](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/add-flows) (Aug 2026: only solution-aware instant flows with the Power Apps trigger; `@microsoft/power-apps` ≥ 1.1.1; re-run `add flow` after changes; end users need the App Opener role or equivalent), [Add a Dataverse action or function](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/add-dataverse-action-function), and the [asynchronous flow pattern](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/asychronous-flow-pattern) (120-second response limit).

**Lessons from the production app [P], generalised:** positional flow inputs (`text` … `text_14`); `success: true` vs the flow's own outcome, and the bug where an unparseable response took the success path; idempotent retry; status and error in one write, with the error-recording write unable to mask the original error; optional-inputs-first contract changes; a job store at the app root so flow calls outlive the page; the two old-CLI gotchas (alias mismatch, `workflowDetails`), presented as "may be fixed in `pa`".

**Demo changes:** `src/state/jobs.ts` (Zustand job store: one run per key, running jobs can't be dismissed, errors captured), `src/components/job-toasts.tsx` (one sonner toast per job, updated in place; errors persist until dismissed), `src/lib/csv.ts`, `src/lib/export-opportunities.ts`, and an **Export CSV** button on the dashboard. No flow is in the demo: generating a flow service needs a live environment, and hand-writing a "generated" file would be fake. Flow code in the chapter uses a clearly named stand-in (`CloseDealFlowService`).

**Checked:** build and lint pass; a throwaway script exercised the job store (single run per key, dismiss rules, success and error messages, re-run after finish) and CSV escaping. Not run in the Power Apps player; `WhoAmI`/`WinOpportunity` via `pa app add dataverse-api` are taken from the docs, not tried.

## Chapter 9 log (2026-09-28)

Written: [learnings/chapter-9-shipping.md](../learnings/chapter-9-shipping.md).

**Lessons from the production app [P], generalised:** version and build date injected from `package.json` with Vite `define`; date-based release tags; the player's own "new version" notice gets missed, and a plain reload can re-serve the cached bundle (hard refresh works); a required-version environment variable gate, re-checked on an interval and on focus, softened to a banner while edits are unsaved; an environment banner driven by an environment variable; deep links as player URLs with a `route` query parameter read from `getContext().app.queryParams` (the iframe's `location.href` isn't shareable and the player drops the hash); a Clipboard API fallback inside the iframe; the tester onboarding and troubleshooting lists.

**Corrected while writing:** the production gate compared versions with "not equal". The chapter uses a part-by-part "older than" comparison instead, because "not equal" blocks every new build whose release didn't also bump the variable.

**Demo changes:** `package.json` version set to `1.0.0`; `vite.config.ts` defines `__APP_VERSION__` / `__BUILD_DATE__`; `src/lib/version.ts` (shown in the header with the build time as a tooltip); `src/lib/context.ts` (`getContextWithTimeout`, now shared by `useAppContext` and deep links; Ch 6 snippet updated); `src/lib/deep-link.ts` (`buildShareUrl`, `getLaunchRoute` with route validation, `copyText` with fallback); `src/components/deep-link-bootstrap.tsx` (in the layout); `src/components/copy-link-button.tsx` (on the account page).

**Chapter code only (needs environment-variable tables from a live environment):** the required-version gate and the environment banner.

**Checked:** build and lint pass; the built bundle contains the version string from `package.json`. Not run in the player: the `/play/e/<env>/app/<app>` URL shape is the one the production app shipped and the CLI printed (Microsoft's header docs show `/a/<app>`); query-parameter forwarding and the clipboard fallback are from production, not re-tested here.

## Chapter 10 log (2026-09-28)

Written: [learnings/chapter-10-canvas-to-code.md](../learnings/chapter-10-canvas-to-code.md).

**Lessons from the production app [P], generalised:** no converter (keep schema, flows, rules); the migration drivers and the "team must own React" caveat; pin the Canvas export and track reference versions; measure first; spike the unknowns (the written plan's paging hook set `top` with `maxPageSize` and could never reach page 2); the Power Fx → code mapping; merging near-duplicate screens into one parameterised component; small screens first, core screen last in slices; the spec → confirm → build → parity → tests → commit loop; "awaiting live parity" as the dominant status; the differences log (100+ rows), including a Canvas bug found in translation; logic Canvas hid (status updates after a flow); mirror layout and colours, upgrade controls; regenerate after schema changes and review generated diffs; gradual cutover on shared Dataverse.

**Softened for confidentiality:** exact screen counts, YAML line counts, region count and the new screen's subject are replaced with general descriptions.

**New in the repo:**
- `tools/measure-canvas-app.mjs`: Node, no dependencies. Inventory of screens, controls, Power Fx functions (with replacements), flow calls, data sources, and near-duplicate screens; `--diff` compares two screens with each file's control names replaced by a placeholder. Checked on the production app's real export, unpacked only in the session scratchpad (never copied into the repo): the Dataverse table count matched the app's own hand-made inventory, the copied screen pair scored 85%, a small false positive at 68% was excluded by the 70% threshold, and `--diff` cut a ~2,600-line plain diff to ~500 lines.
- `tools/sample-canvas-app/`: a made-up CRM Canvas App (3 screens, 1 component) with a deliberately copied pair that differs by region and by one drifted manager check. The tool finds the pair at 91%, and `--diff` shows both the parameter and the drift.
- `templates/migration/`: `SCREEN_SPEC.md`, `MIGRATION_TRACKER.md`, `DIFFERENCES.md`.

**Unverified:** why a newly added column came back empty before regeneration. SDK 1.4.0's client code doesn't filter `select` against the schema, so the cause was elsewhere (the host, or 1.2.x). The chapter states the observation and the safe rule, not a mechanism.

## Chapter 11 log (2026-09-28)

Written: [learnings/chapter-11-ai-coding-agent.md](../learnings/chapter-11-ai-coding-agent.md). **Part 2 is complete.**

**Sources checked [D]:** [Quickstart: build a code app with GitHub Copilot](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/quickstart-github-copilot) (Jun 2026: `/plugin marketplace add microsoft/power-platform-skills`, `/plugin install code-apps-preview@power-platform-skills`; also works with Claude Code) and the plugin's [`AGENTS.md`](https://github.com/microsoft/power-platform-skills/blob/main/plugins/code-apps/AGENTS.md), which states that direct HTTP (`fetch`, `axios`, Graph) doesn't work at runtime and all external data must go through connectors. That rule was missing from the guide; it's now in Ch 8, Ch 11, the README (gotcha 25) and the demo's `AGENTS.md`.

**Lessons from the production app [P], generalised:** rules that came from agent mistakes (invented SDK methods, edits to generated files, unbounded queries, bare-default UI, UI text conventions); the "isn't stored anywhere" error from treating `src/generated/` as the schema, fixed by one data-source add; a stale rule in the rules file (delete-and-re-add after refresh-in-place worked); specs before code with open questions; humans own sign-ins, environments and deploys; platform plans written into `docs/specs/` with the human's and agent's steps separated; review focus (error paths vs comments, lying types, queries in loops, silent limits, unescaped filters, flow contracts); continuity in repo documents over agent memory; review and parity as the bottleneck.

**Softened:** the rules table no longer claims every rule followed a real incident; some were anticipated.

**New in the repo:** `crm-sales-hub/AGENTS.md` (rules for this demo) with `crm-sales-hub/CLAUDE.md` importing it (`@AGENTS.md`); `templates/agent/AGENTS.md` (a template for migration projects: status, sources of truth, hard rules, who does what, the per-screen loop, definition of done).

## Sources

- [Code apps overview](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview) (2026-09-23)
- [Power Apps CLI reference](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/reference/cli) (2026-09-15)
- [Quickstart: create a code app with the Power Apps CLI](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/create-an-app-from-scratch) (2026-08-13)
- [Connect to data](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-data) (2026-08-19)
- [Connect to Dataverse](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse) (2026-08-14)
- [System limits and configuration](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/system-limits-configuration) (2026-09-15)
- [PowerAppsCodeApps discussion #286: mobile support](https://github.com/microsoft/PowerAppsCodeApps/discussions/286)
