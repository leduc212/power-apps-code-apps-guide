# Power Apps Code Apps: CRM Sales Hub Guide

A hands-on learning series for CRM/Dynamics 365 developers building Power Apps Code Apps. Includes a working **CRM Sales Hub** demo app (React + TypeScript + Dataverse) and blog-ready chapters, from first setup to shipping in production.

> **GA date:** Power Apps Code Apps became generally available on **February 5, 2026**.
>
> **Updated September 2026.** This guide was first written at GA. Since then the CLI has been replaced, the client library has moved from 1.0 to 1.4, several limitations have gone, and I've shipped a production Code App that replaced a large Canvas App. Part 1 has been rewritten against the current platform, with corrections called out where the February version was wrong. Part 2 is new: five chapters on what production actually needed. The February version is preserved at the [`v1-feb-2026`](https://github.com/leduc212/power-apps-code-apps-guide/tree/v1-feb-2026) tag.

---

## What Is This Repo?

A learning journey through Power Apps Code Apps: Microsoft's way for pro-code developers to build standard SPAs (React, Vue, TypeScript/Vite) and host them inside Power Platform, with Entra authentication, connectors, DLP, ALM and managed hosting included.

**What you get:**

- **`crm-sales-hub/`**: a working Code App on the standard Dynamics 365 Account, Contact and Opportunity tables. CRUD, a pipeline dashboard with recharts, user context via `getContext()`, and error handling that actually surfaces errors.
- **`learnings/`**: blog-ready chapters documenting what was built, the decisions behind it, and every gotcha hit along the way.
- **`tools/`** and **`templates/`**: a script that turns a Canvas App into a migration inventory, and templates for migration specs, tracking, and an AI agent's project rules.
- **`docs/v2-audit.md`**: the claim-by-claim audit behind the September update: what changed, what was wrong, and the evidence for each.

**Who this is for:** Power Apps / Dynamics 365 developers with some front-end experience who want to understand Code Apps without starting from scratch.

---

## Repo Structure

```
power-apps-code-apps-guide/
├── crm-sales-hub/              ← The demo Code App (setup in its README)
│   ├── AGENTS.md               ← Rules for AI coding agents (CLAUDE.md imports it)
│   └── src/
│       ├── pages/              ← accounts, account-detail, dashboard
│       ├── hooks/              ← useAppContext, useDebouncedValue, usePagedQuery
│       ├── lib/dataverse.ts    ← unwrap, formattedValue, odataString
│       ├── lib/paging.ts       ← fetchAllPages, fetchByIds
│       ├── state/jobs.ts       ← background jobs that outlive the page
│       ├── lib/deep-link.ts    ← shareable player links, replayed on launch
│       ├── lib/version.ts      ← version + build date from package.json
│       ├── generated/          ← Generated models & services (do not edit)
│       └── router.tsx
├── learnings/
│   ├── chapter-1-paradigm.md
│   ├── ...
│   ├── chapter-6-alm.md
│   ├── chapter-7-data-at-scale.md
│   ├── chapter-8-flows-and-connectors.md
│   ├── chapter-9-shipping.md
│   ├── chapter-10-canvas-to-code.md
│   └── chapter-11-ai-coding-agent.md
├── tools/
│   ├── measure-canvas-app.mjs  ← Canvas App → migration inventory
│   └── sample-canvas-app/      ← A made-up Canvas App to try it on
├── templates/
│   ├── migration/              ← Screen spec, tracker, differences log
│   └── agent/AGENTS.md         ← Agent rules template for a migration project
├── docs/
│   └── v2-audit.md             ← What changed between Feb and Sep 2026
└── README.md                   ← You are here
```

---

## Prerequisites

| Tool | Why |
|---|---|
| [Node.js LTS](https://nodejs.org/) and Git | npm, build tooling, scaffolding |
| Power Apps CLI: `npm install --global @microsoft/power-apps-cli` | Sign in, initialize, add data sources, publish (`pa ...`) |
| A Power Platform environment with Dataverse | With **code apps enabled** (admin setting) |
| A licence for each end user | Power Apps Premium, an App Pass, pay-as-you-go, or auto-claim |

You no longer need the Power Platform CLI (`pac`) to build a Code App. It's still the tool for solution export/import and pipelines.

### Enable Code Apps on Your Environment

An admin enables it per environment (or for many at once through environment groups and rules):

1. [Power Platform admin center](https://admin.powerplatform.microsoft.com) → **Manage** → **Environments** → select environment
2. **Settings** → **Product** → **Features**
3. **Power Apps code apps** → toggle **Enable code apps** → **Save**

> If you are not an admin, this is the first blocker you will hit. There is no workaround.

### Licensing

At GA every end user needed Power Apps **Premium**. Today an App Pass, pay-as-you-go, or auto-claim of an available Premium licence also work. For organizations already on Premium (for example with full Dynamics 365 licences) there's no additional cost. For a small team or occasional users, do the math against an Azure-hosted web app before committing.

---

## The Series

### Part 1: Foundations (updated September 2026)

| # | Chapter | What You Build | Blog Post Title |
|---|---|---|---|
| 1 | [Understanding the Paradigm](learnings/chapter-1-paradigm.md) | Mental model only | *Power Apps Code Apps: A CRM Developer's Guide to the New Code-First Approach* |
| 2 | [Hello World & Tooling](learnings/chapter-2-hello-world.md) | A Code App live in Power Platform | *Your First Power Apps Code App: From Zero to Live in Power Platform* |
| 3 | [Connecting to Dataverse](learnings/chapter-3-dataverse.md) | Accounts list with live data and search | *Dataverse from TypeScript: How Power Apps Code Apps Generates Your Data Layer* |
| 4 | [Full CRUD for CRM Records](learnings/chapter-4-crud.md) | Account detail, create/delete Opportunities | *CRM CRUD in Power Apps Code Apps: Gotchas with Lookups, Option Sets, and Required Fields* |
| 5 | [Dashboard & Data Visualization](learnings/chapter-5-dashboard.md) | KPI cards + recharts bar charts | *Building CRM Dashboards That Canvas App Can't: Data Visualization in Power Apps Code Apps* |
| 6 | [Context, ALM & Production Readiness](learnings/chapter-6-alm.md) | User in header, solutions, pipelines | *Shipping a Power Apps Code App to Production: Context, ALM, Solutions, and Pipelines* |

### Part 2: Production (new, September 2026)

Lessons from shipping a production Code App that replaced a large Canvas App, rewritten against this repo's demo tables.

| # | Chapter | Covers |
|---|---|---|
| 7 | [Data at Scale](learnings/chapter-7-data-at-scale.md) | Server-side paging with `skipToken`, total counts, fetching complete lists, joins without `$expand` |
| 8 | [Flows and Connectors](learnings/chapter-8-flows-and-connectors.md) | Calling Power Automate flows, UI for long-running jobs, Dataverse custom APIs |
| 9 | [Shipping for Real](learnings/chapter-9-shipping.md) | App versioning, stale-bundle detection, deep links, environment banners, tester onboarding |
| 10 | [Canvas → Code Migration](learnings/chapter-10-canvas-to-code.md) | Measuring a Canvas App, mapping Power Fx to TypeScript, merging duplicate screens, tracking parity |
| 11 | [Building with an AI Coding Agent](learnings/chapter-11-ai-coding-agent.md) | Project rules, specs before code, reviewing generated code |

### Running the Demo App

Full instructions are in [`crm-sales-hub/README.md`](crm-sales-hub/README.md). In short:

```bash
cd crm-sales-hub
npm install
pa auth login
pa app init --display-name "CRM Sales Hub" --environment-id <your-env-id>
pa app add data-source --connector dataverse --table account
pa app add data-source --connector dataverse --table contact
pa app add data-source --connector dataverse --table opportunity
npm run dev
# Open the Local Play URL printed in the terminal
```

---

## Gotchas & Q&A

> The things that only became obvious after building something real. Most aren't clearly documented. Details and code are in the linked chapters.

### Local development

**1. `npm run dev` is the only command you need (starter template).** The `starter` template includes the `powerApps()` Vite plugin, which serves your app and the local host config on one port. The minimal `vite` template doesn't; there you also run `pa app run`. See [Chapter 2](learnings/chapter-2-hello-world.md).

**2. Open the Local Play URL, not localhost.** The Local Play URL loads your local app inside the real Power Apps host, which handles sign-in and connectors. Raw `localhost` has neither.

**3. Allow local network access.** Chrome and Edge block public sites (the Power Apps host) from calling `localhost` by default. Allow the prompt. On managed devices, ask IT about the local network access policy. Embedded iframes need `allow="local-network-access"`.

**4. Use the browser profile signed in to your tenant.** The host uses your existing Entra session. A different profile means a different identity and a confusing failure.

**5. Check `pa auth status` before every push.** If you work across tenants, the CLI pushes to whatever the active account points at.

### Reading data

**6. Services don't throw when a request fails.** `getAll`, `get`, `create` and `update` resolve with `{ success: false, error }`. `result.data ?? []` turns a failed query into an empty table, and TanStack Query never reports an error. Wrap every call in a small `unwrap()` that throws. See [Chapter 3](learnings/chapter-3-dataverse.md).

**7. Read labels from `FormattedValue` annotations, not `...name` properties.** Dataverse returns `"<column>@OData.Community.Display.V1.FormattedValue"` next to every choice, lookup, date and money value. The generated `statecodename`-style properties aren't populated, and putting one in `select` causes a 400 (it isn't a column).

**8. Coerce numbers with `Number()`.** Generated models type choice and money columns as strings, but values arrive as numbers, so `statecode === "0"` is always false. Compare with `Number(x) === 0`.

**9. `getAll` returns one page.** 500 rows by default (`maxPageSize` goes up to 5,000); the rest is silently dropped, and `result.skipToken` tells you there's more. Page with `skipToken` (Dataverse has no `$skip`), and never combine `top` with paging: `top` suppresses the `skipToken`. SDK 1.4 adds `count: true` (capped at 5,000). See [Chapter 7](learnings/chapter-7-data-at-scale.md).

**10. Escape user input in filters.** OData strings use single quotes, so a search for *O'Brien* breaks `contains(name, '...')`. Double the quotes: `value.replace(/'/g, "''")`.

**11. No `$expand`, FetchXML, alternate keys or polymorphic lookups.** Related data comes from separate queries (run them in parallel) or from lookup `FormattedValue` annotations.

### Writing data

**12. Send numbers as numbers.** Money and decimal columns are typed as strings, but Dataverse rejects `"123"` with an `Edm.Decimal` conversion error. Send `Number(value)`.

**13. Lookup binds use the navigation property name, and the generated keys can be wrong.** Use `"<navigation-property>@odata.bind": "/<entity-set>(<id>)"`. The generated model offers keys built from schema names (`ParentAccountId@odata.bind`); on system tables the real navigation property is often lowercase (`parentaccountid`). See [Chapter 4](learnings/chapter-4-crud.md).

**14. Polymorphic binds are officially unsupported.** `"customerid_account@odata.bind"` worked in this demo, but the docs list polymorphic lookups as not supported. Bind `parentaccountid` if it fails.

**15. On update, send only what changed.** Every property you send counts as changed: plugins and flows fire and the audit log records it.

**16. The generated `delete()` can drop the result.** In this demo it returns `Promise<void>`, so a rejected delete looks like success. Check your generator's signature.

### Context and ALM

**17. `context.user.objectId` ≠ Dataverse `systemuserid`.** Resolve it through `systemuser.azureactivedirectoryobjectid`. See [Chapter 6](learnings/chapter-6-alm.md).

**18. `getContext()` never resolves without a host.** Wrap it in a timeout.

**19. Environment variables aren't in `appSettings`.** Use `@envvar:` references when adding data sources; to read a value in code, query the environment variable tables.

**20. Bind non-Dataverse data sources to connection references** (`--connection-ref --solution-id`) so the solution is portable between environments.

### CLI

**21. Schema changed? `pa app refresh data-source`, every time.** No more delete-and-re-add. Until you regenerate, a newly added column can simply come back empty. Review the generated diff before committing it. See [Chapter 10](learnings/chapter-10-canvas-to-code.md).

**22. Connections can be created from the CLI now.** `pa connection create --connector <id>`.

**23. When prompted for an organization URL, include `https://`.** Without it, sign-in fails with `AADSTS70011` (invalid scope).

**24. `--table` takes the logical name**: singular and lowercase (`account`), not the entity set name.

### Security and architecture

**25. No direct HTTP.** `fetch`, `axios` and Microsoft Graph calls don't work at runtime in a Code App. External data goes through connectors, flows or Dataverse custom APIs; a service without a connector needs a custom connector or a flow. See [Chapter 8](learnings/chapter-8-flows-and-connectors.md).

**26. Your compiled bundle is publicly downloadable. Keep secrets out of it.** Playing the app requires Entra sign-in, but the built JS is served from a public endpoint, like any SPA on a CDN. No API keys, passwords or sensitive logic in front-end code; data goes through connectors, which are authenticated and DLP-enforced. IP restrictions come from Entra Conditional Access, not storage SAS IP binding. From the [docs](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/system-limits-configuration): *"Don't store sensitive user or organizational data in the app."*

---

## Comparison: Which App Type Should You Choose?

> Includes an often-overlooked option: a custom SPA embedded as a Web Resource in a Model-Driven App, which many D365 developers already use for custom dashboards and forms.

| | **Canvas App** | **Model-Driven App** | **Power Pages** | **Code App** | **SPA Web Resource in MDA** |
|---|---|---|---|---|---|
| **Target audience** | Makers + pro-devs | Functional consultants + devs | Makers + pro-devs | Pro/enterprise devs | Pro-code D365 devs |
| **Dev experience** | Power Fx + drag-and-drop | Metadata-driven configuration | Low/pro-code + Liquid templates | Full IDE: React/Vue/TS, npm | Full code, bundled as web resource |
| **UI control** | High within canvas constraints | Low (schema-driven forms/views) | Medium (templates + custom HTML/CSS) | Full (any library, pixel-perfect) | Full (isolated SPA) |
| **Data access** | Dataverse + 1,500+ connectors | Dataverse only | Dataverse (via table permissions) | Dataverse + connectors via generated services | Dataverse via `Xrm.WebApi` or REST; no connector ecosystem |
| **Authentication** | Managed by platform | Managed by platform | External (B2C, Entra, anonymous) | Managed by platform (zero config) | Inherited from the MDA session |
| **Mobile** | ✅ Power Apps mobile app | ✅ Power Apps mobile app | ✅ Browser (responsive) | ⚠️ Mobile browser only, not the Power Apps mobile app | ✅ Via the MDA mobile app |
| **npm ecosystem** | ❌ | ❌ | Partial | ✅ Full | ✅ Full during build |
| **Charting/custom UI** | Limited (built-in controls) | Limited (Power BI embed, built-in charts) | Medium | ✅ Any library | ✅ Any library |
| **SharePoint forms** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **External users** | Azure B2B guests | ❌ | ✅ Primary use case | Azure B2B guests | ❌ |
| **ALM** | Solution-based | Solution-based | Solution-based | Solution-based + your own git repo | Solution web resources |
| **Power Platform Git integration** | ✅ | ✅ | ✅ | ❌ Not supported | ✅ |
| **Licence** | Premium for premium connectors | Premium | Per-site + capacity | Premium, App Pass, pay-as-you-go or auto-claim | Premium (MDA) |
| **Governance (DLP, Conditional Access)** | ✅ | ✅ | Partial | ✅ Including per-app Conditional Access | Partial (within MDA) |

### Decision Guide

```
Is the UI mostly forms, views and timelines on Dataverse?
  → Model-Driven App

Is it external-facing (customers, partners, anonymous)?
  → Power Pages

Do users need it inside the Power Apps mobile app?
  → Canvas App or Model-Driven App (Code Apps run in the browser only)

Do you need a custom SPA inside an existing Model-Driven App
(a dashboard tab, a record form replacement)?
  → SPA Web Resource in MDA (or PCF for a single component)

Do you need full UI control, the npm ecosystem and Power Platform governance,
in the browser, and your users are licensed?
  → Code App

Rapid prototyping, maker-built, maker-maintained?
  → Canvas App
```

---

## Official Limitations

From the [Microsoft Learn docs](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview) as of September 2026:

| Limitation | Detail |
|---|---|
| **Not in the Power Apps mobile app or Power Apps for Windows** | Code Apps run in a browser. (Microsoft's separate "native mobile apps" preview is a different product.) |
| **No Power Platform Git integration** | Use your own repo. |
| **No SAS IP restriction** | Assets are served from a public endpoint; restrict by IP with Entra Conditional Access. |
| **No Secure Implicit Connections** | Not yet supported. |
| **No Power BI integration** | No `PowerBIIntegration` function; can be embedded in Power BI via the Power Apps visual. |
| **No SharePoint forms** | Can't replace SharePoint list forms. |
| **Excel Online connectors unsupported** | Excel Online (Business) and Excel Online (OneDrive). |
| **Dataverse: no polymorphic lookups, FetchXML, alternate keys or schema CRUD** | See gotchas 11 and 14. |
| **Local development needs local network access** | Chrome/Edge block public-to-localhost requests until allowed. |

**Removed since GA:** no schema refresh command (now `pa app refresh data-source`), no connection creation from the CLI (now `pa connection create`), Premium-only licensing, and no external users (Azure B2B guests now work).

**Supported managed-platform features:** connector consent dialogs, sharing limits, app quarantine, DLP enforcement at launch, per-app Conditional Access, admin consent suppression, tenant isolation, Azure B2B guests, and health metrics.

---

## Our Take

*Originally written at GA in February 2026; revised in September 2026 after shipping a production Code App.*

### The Genuine Value

The value is real: **auth, connectors, governance and hosting as a service.** Setting up authentication (MSAL, app registrations, token handling) is genuinely painful in traditional web development. Building your own connector integrations is worse. Code Apps removes both: you write React components, and the platform handles the rest.

For organizations already deep in Power Platform (D365, existing Dataverse data, established DLP policies), Code Apps slots in well. The gap between "I need a custom dashboard" and "we need a new Azure-hosted app with its own auth" is much smaller.

Seven months later, I'd add one thing I underrated: **a Code App is maintainable in a way a large Canvas App isn't.** Typed code, git diffs, code review and unit tests matter far more once the app is big. The production app I shipped replaced tens of thousands of lines of Power Fx, including two near-identical screens that became one parameterised component, and server-side paging that Canvas had only been able to fake.

### The AI Coding Agent Angle

At GA I noticed how naturally Code Apps pairs with AI coding agents. After a real project, I'd put it more strongly: Power Fx and the canvas designer are hard for agents to work with; TypeScript and React are what they're best at. Microsoft leans into this too: it now publishes a [code apps plugin](https://github.com/microsoft/power-platform-skills) for GitHub Copilot and Claude Code, and a quickstart that goes from a prompt to a deployed app.

The caveat I learned the hard way: **an agent needs rules and review.** The client library is young, and an agent will confidently invent method names or "fix" generated files. Project rules ("never edit `generated/`", "check every call against the generated services", "always `select`"), specs confirmed before code, and a human reviewing every change made the difference. [Chapter 11](learnings/chapter-11-ai-coding-agent.md) covers it, and the demo's [`AGENTS.md`](crm-sales-hub/AGENTS.md) is a working example.

### The Real Concerns

**Tooling churn is real.** In seven months the CLI went from `pac code` to `npx power-apps` to `pa`, and the client library from 1.0 to 1.4. Each change was an improvement, but tutorials (including the first version of this one) went stale fast, and my production project was built on a CLI that has since been replaced. Pin your versions, and budget time to follow the platform.

**Licensing is better, but still do the math.** App Pass, pay-as-you-go and auto-claim make small or occasional audiences cheaper than Premium-only did. It's still a per-user cost that an Azure Static Web App doesn't have.

**Mobile is still a gap.** "Runs in a browser" still means not in the Power Apps mobile app your Canvas users have installed. For field-facing scenarios this remains a blocker.

**Generated types need care.** Number types, bind keys and a `delete()` that drops its result all mean you can't trust the generated layer blindly. Put a thin wrapper around it and test the writes.

### Overall Assessment

Code Apps is a strong fit for **pro-code applications on Power Platform data, built by development teams (increasingly, with AI agents), for internal or guest users on the web.** For that it's genuinely excellent: better developer experience than Canvas, more UI freedom than Model-Driven, and better governance than a DIY Azure app.

It's also a credible target for **replacing Canvas Apps that have outgrown Power Fx**, if the team can own a React codebase. It isn't a replacement for Canvas as a maker tool, or for Model-Driven as a forms-over-data tool, and it isn't yet an option for apps that must live in the Power Apps mobile app.

---

## Sources

| Source | URL |
|---|---|
| Power Apps Code Apps overview (MS Learn) | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview) |
| Power Apps CLI command reference | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/reference/cli) |
| Quickstart: create a code app with the Power Apps CLI | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/create-an-app-from-scratch) |
| Connect to data | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-data) |
| Connect to Dataverse | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse) |
| Use environment variables in code app data sources | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/use-environment-variables) |
| System limits and configuration | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/system-limits-configuration) |
| `pac pipeline` reference | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/pipeline) |
| Official GitHub repository (templates, samples) | [github.com/microsoft/PowerAppsCodeApps](https://github.com/microsoft/PowerAppsCodeApps) |
| Code Apps in the Power Apps mobile app (feature request) | [GitHub discussion #286](https://github.com/microsoft/PowerAppsCodeApps/discussions/286) |
| Power Apps native mobile apps (preview) | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/mobile/native-apps/overview) |
| GA announcement (Feb 5, 2026) | [Microsoft Power Platform Blog](https://www.microsoft.com/en-us/power-platform/blog/power-apps/generally-available-host-and-run-code-apps-in-power-apps/) |

---

## License

MIT. See [LICENSE](LICENSE).

---

*Built by a CRM/Power Apps specialist learning in public. Issues and PRs welcome.*

*Documentation and code examples were written with the help of Claude: Sonnet 4.6 for the February version, Opus 5.5 for the September update.*
