# Power Apps Code Apps — CRM Sales Hub Guide

A hands-on learning series for CRM/Dynamics 365 developers building their first Power Apps Code App. Includes a working **CRM Sales Hub** demo app (React + TypeScript + Dataverse) and six blog-ready chapter guides covering everything from setup to production deployment.

> **GA date:** Power Apps Code Apps became generally available on **February 5, 2026**.

---

## What Is This Repo?

This repository documents a real learning journey through Power Apps Code Apps — Microsoft's new capability that lets pro-code developers build standard SPAs (React, Vue, TypeScript/Vite) and host them directly inside Power Platform, complete with Entra authentication, 1,500+ connectors, DLP policies, ALM, and managed hosting.

**What you get:**

- **`crm-sales-hub/`** — A working Code App connected to Dynamics 365 Dataverse (Accounts, Contacts, Opportunities). Full CRUD, a sales pipeline dashboard with recharts, and user context via `getContext()`.
- **`learnings/`** — Six blog-ready chapter guides documenting what was built, the decisions made, and every gotcha hit along the way.

**Who this is for:** Power Apps / Dynamics 365 developers with some front-end experience who want to understand Code Apps without starting from scratch.

---

## Repo Structure

```
power-apps-code-apps-guide/
├── crm-sales-hub/              ← The working Code App
│   └── src/
│       ├── pages/              ← accounts.tsx, account-detail.tsx, dashboard.tsx
│       ├── hooks/              ← useAppContext.ts
│       ├── generated/          ← Auto-generated SDK models & services (do not edit)
│       └── router.tsx
├── learnings/
│   ├── chapter-1-paradigm.md
│   ├── chapter-2-hello-world.md
│   ├── chapter-3-dataverse.md
│   ├── chapter-4-crud.md
│   ├── chapter-5-dashboard.md
│   └── chapter-6-alm.md
└── README.md                   ← You are here
```

---

## Prerequisites

| Tool | Why |
|---|---|
| [Node.js LTS](https://nodejs.org/) | npm, build tooling |
| [Power Platform CLI (PAC)](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction) | `pac code add-data-source` for adding Dataverse tables |
| A Power Platform environment | With Code Apps enabled (admin setting) |
| **Power Apps Premium license** | Required for every end-user who runs a Code App |

### Enable Code Apps on Your Environment

Code Apps must be explicitly enabled per environment by an admin:

1. [Power Platform Admin Center](https://admin.powerplatform.microsoft.com) → **Environments** → select environment
2. **Settings** → **Product** → **Features**
3. Toggle **Enable code apps** → **Save**

> If you are not an admin, this is the first blocker you will hit. It is not optional.

### License Cost

End-users need a **Power Apps Premium** license (~$20 USD/user/month as of 2026). Unlike some scenarios where per-app licensing is sufficient, Code Apps require Premium. This is a real cost consideration — for small teams or external users, an Azure-hosted web app may be cheaper. For organizations already on Premium (e.g., full Dynamics 365 licenses), this is no additional cost.

---

## The 6-Chapter Series

| # | Chapter | What You Build | Blog Post Title |
|---|---|---|---|
| 1 | [Understanding the Paradigm](learnings/chapter-1-paradigm.md) | Mental model only | *Power Apps Code Apps: A CRM Developer's Guide to the New Code-First Approach* |
| 2 | [Hello World & Tooling](learnings/chapter-2-hello-world.md) | Working Code App live in Power Platform | *Your First Power Apps Code App: From Zero to Live in Power Platform* |
| 3 | [Connecting to Dataverse](learnings/chapter-3-dataverse.md) | Accounts list with live data and search | *Dataverse from TypeScript: How Power Apps Code Apps Generates Your Data Layer* |
| 4 | [Full CRUD for CRM Records](learnings/chapter-4-crud.md) | Account detail page, create/delete Opportunities | *CRM CRUD in Power Apps Code Apps: Gotchas with Lookups, Option Sets, and Required Fields* |
| 5 | [Dashboard & Data Visualization](learnings/chapter-5-dashboard.md) | KPI cards + recharts bar charts from live data | *Building CRM Dashboards That Canvas App Can't: Data Visualization in Power Apps Code Apps* |
| 6 | [Context, ALM & Production Readiness](learnings/chapter-6-alm.md) | User name in header, ALM guide | *Shipping a Power Apps Code App to Production: Context, ALM, Solutions, and Pipelines* |

### Running the Demo App

```bash
cd crm-sales-hub
npm install
npx power-apps init --displayName "CRM Sales Hub" --environmentId <your-env-id>
# Add data sources (requires PAC CLI and existing connections in Power Apps portal)
pac code add-data-source -a dataverse -t account
pac code add-data-source -a dataverse -t opportunity
pac code add-data-source -a dataverse -t contact
npm run dev
# Open the Local Play URL printed in the terminal
```

---

## Gotchas & Q&A

> These are the things that only become obvious after you've actually built something. None of them are clearly documented upfront.

### 1. `npm run dev` is the only command you need locally

The `starter` template includes the `powerApps()` Vite plugin (`@microsoft/power-apps-vite`), which runs both your React dev server **and** the SDK connector endpoint on the same port (5173). You do not need `npx power-apps run` in a separate terminal.

The minimal `vite` template does **not** include the plugin — if you use that template, you need two terminals. Use `templates/starter` for real projects.

### 2. Open the Local Play URL, not localhost

During local development, your app runs on `http://localhost:5173`. But you should not open that URL directly. Open the **Local Play URL** printed by `npm run dev`:

```
https://apps.powerapps.com/play/e/<env-id>/a/local?_localAppUrl=http://localhost:5173/...
```

This URL loads your app inside the actual Power Apps host, which handles authentication. Opening raw localhost skips the host entirely — no auth, no connectors.

### 3. Browser blocks localhost from public origins (Chrome/Edge, since Dec 2025)

When you open the Local Play URL, the Power Apps host (a public `apps.powerapps.com` origin) tries to make requests to your local SDK endpoint (`localhost:5173`). Chrome and Edge block this by default since December 2025 (private network access restrictions).

The browser will prompt you to **Allow**. Click it. If the prompt doesn't appear on a managed/locked-down device:
- Edge: `edge://flags/#local-network-access-permission`
- Chrome: enable the permission in site settings

### 4. Use the same browser profile as your Power Platform tenant

The Local Play URL relies on your existing Entra session in the browser. If you open it in a profile that isn't signed into your Power Platform tenant, auth fails silently. Same profile = same identity = it works.

### 5. `statecode` is typed as `string` but arrives as `number`

The generated TypeScript model types `statecode` as a string union (`"0" | "1" | "2"`). At runtime, Dataverse returns it as a number. This means:

```typescript
// This will always be false — even when the record is Active:
account.statecode === "0"

// This works:
Number(account.statecode) === 0
```

This affects **every** option set field in the generated models. Always cast with `Number()` before comparing. See [Chapter 3](learnings/chapter-3-dataverse.md) for the full explanation.

### 6. `statecodename` in a `$select` causes a 400 error

`statecodename` looks like a Dataverse field — it appears in the model as a readable property. But it is not a column; it is an OData annotation that Dataverse attaches automatically. You cannot `$select` it explicitly.

```typescript
// ❌ 400 error: "Could not find property 'statecodename'"
select: ["name", "statecode", "statecodename"]

// ✅ Works — statecodename is returned automatically alongside statecode
select: ["name", "statecode"]
```

Rule: if a field ends in `name` and is not in the base interface (only in the extended `Opportunities` / `Accounts` interface), it is an annotation. Do not put it in `select`.

### 7. Decimal/currency fields are typed as `string` but the API requires `number`

Fields like `estimatedvalue` are typed as `string` in the generated model. If you send a string to Dataverse on create or update, you get:

```
Cannot convert a value to target type 'Edm.Decimal' because of conflict between input format string/number.
```

Always convert with `Number()` before sending:

```typescript
estimatedvalue: Number(form.estimatedvalue)
```

This applies to all currency, decimal, and integer fields.

### 8. Linking records with polymorphic lookups: typed OData bind syntax

Opportunity's customer field is polymorphic — it can link to Account or Contact. You cannot set `_parentaccountid_value` directly on create (it's read-only). The correct syntax:

```typescript
// ✅ This works
"customerid_account@odata.bind": `/accounts(${accountId})`

// ❌ These do not work (common mistakes):
_parentaccountid_value: accountId           // read-only, rejected
"ParentAccountId@odata.bind": "..."         // PascalCase not recognised by Dataverse
customerid: accountId, customeridtype: "account"  // these properties don't exist on the OData type
```

Pattern: `<fieldname>_<entitytype>@odata.bind`. For Contact: `customerid_contact@odata.bind`. See [Chapter 4](learnings/chapter-4-crud.md).

### 9. Generated types on write operations require `as any`

The `OpportunitiesBase` interface marks several fields as required that Dataverse defaults server-side (`ownerid`, `owneridtype`, `TransactionCurrencyId@odata.bind`). Combined with the numeric type mismatches, the generated type doesn't accurately describe what the API accepts on create.

The pragmatic solution: cast the create payload to `as any`. This is honest — satisfying the TypeScript type would cause the API call to fail.

```typescript
await OpportunitiesService.create({ name: form.name, ... } as any)
```

### 10. `context.user.objectId` ≠ Dataverse `systemuserid`

`getContext()` gives you `user.objectId` — the Azure AD Object ID (e.g., `3fa85f64-...`). Dataverse stores the user's **`systemuserid`** in `_ownerid_value`, which is a different GUID.

Filtering `_ownerid_value eq ${context.user.objectId}` will silently return zero results.

To filter "My Opportunities" correctly:
1. Add `systemuser` as a data source: `pac code add-data-source -a dataverse -t systemuser`
2. Query it: `filter: \`azureactivedirectoryobjectid eq ${context.user.objectId}\``
3. Use the returned `systemuserid` in the opportunity filter

See [Chapter 6](learnings/chapter-6-alm.md).

### 11. No schema refresh command

If you change a connector's schema (add a column to a Dataverse table, update a SQL table), there is no `pac code refresh-data-source` command. You must delete the data source and re-add it:

```bash
pac code delete-data-source -a <apiName> -ds <dataSourceName>
pac code add-data-source -a <apiName> ...
```

This regenerates the model and service files from scratch.

### 12. You cannot create connections via CLI

Connections must exist in the Power Apps maker portal before you can reference them via CLI. The CLI commands reference connections by ID — they cannot create new ones. Workflow:

1. Go to [make.powerapps.com](https://make.powerapps.com) → **Data** → **Connections** → create the connection
2. `pac connection list` to get the connection ID and API name
3. `pac code add-data-source -a <apiName> -c <connectionId>`

### 13. Hosted app code is publicly accessible

When you push with `npx power-apps push`, the compiled bundle is hosted on a publicly accessible endpoint. Do not embed secrets, API keys, or sensitive data in your app code. All sensitive operations should go through connectors (which enforce DLP and authentication server-side).

### 14. Two CLIs exist — the npm CLI is replacing `pac code`

| Approach | Commands | Status |
|---|---|---|
| New npm CLI (SDK v1.0.4+) | `npx power-apps init/run/push` | **Recommended** |
| Legacy PAC CLI | `pac code init/run/push` | Being deprecated |

The npm CLI has fewer prerequisites (no PAC CLI needed for basic dev). However, `pac code add-data-source` and `pac connection list` still require the PAC CLI. You need both in practice for Dataverse projects.

---

## Comparison: Which App Type Should You Choose?

> This comparison includes an often-overlooked option: embedding a custom SPA as a Web Resource inside a Model-Driven App — a pattern many D365 developers already use for custom dashboards and forms.

| | **Canvas App** | **Model-Driven App** | **Power Pages** | **Code App** | **SPA Web Resource in MDA** |
|---|---|---|---|---|---|
| **Target audience** | Makers + pro-devs | Functional consultants + devs | Makers + pro-devs | Pro/enterprise devs | Pro-code D365 devs |
| **Dev experience** | Power Fx + drag-and-drop | Metadata-driven configuration | Low/pro-code + Liquid templates | Full IDE: React/Vue/TS, npm | Full code, bundled as web resource |
| **UI control** | High within canvas constraints | Low (schema-driven forms/views) | Medium (templates + custom HTML/CSS) | Full — any library, pixel-perfect | Full — isolated React/Angular SPA |
| **Data access** | Dataverse + 1,500+ connectors | Dataverse only | Dataverse (via table permissions) | Dataverse + 1,500+ connectors via SDK | Dataverse via `Xrm.WebApi` or direct REST; no connector ecosystem |
| **Authentication** | Managed by platform | Managed by platform | External (B2C, AAD, anonymous) | Managed by platform — zero config | Inherited from MDA session (`Xrm.Page`) |
| **Mobile** | ✅ Power Apps mobile app | ✅ Power Apps mobile app | ✅ Browser (responsive) | ❌ Browser only (not Power Apps mobile) | ✅ Via MDA mobile app |
| **npm ecosystem** | ❌ | ❌ | Partial (Power Pages VS Code extension) | ✅ Full — install any package | ✅ Full during build |
| **Charting/custom UI** | Limited (built-in controls) | Limited (Power BI embed, built-in charts) | Medium | ✅ Any library (recharts, D3, Victory...) | ✅ Any library |
| **SharePoint forms** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **External users** | Limited | ❌ | ✅ Primary use case | ❌ (internal Entra only) | ❌ |
| **ALM** | Solution-based | Solution-based | Solution-based | Solution-based + own git repo | Solution web resources |
| **Power Platform Git integration** | ✅ | ✅ | ✅ | ❌ Not supported | ✅ |
| **License** | Premium for some connectors | Premium | Per-site + capacity | **Premium required for all users** | Premium (MDA requires it) |
| **Governance (DLP, Conditional Access)** | ✅ | ✅ | Partial | ✅ | Partial (within MDA) |

### Decision Guide

```
Is your primary data source Dataverse AND the UI is mostly forms/views/timelines?
  → Model-Driven App

Is it external-facing (customers, partners, anonymous)?
  → Power Pages

Does it need to work in the Power Apps mobile app?
  → Canvas App or Model-Driven App (Code Apps are browser-only)

Do you need a custom SPA embedded inside an existing Model-Driven App
(e.g., a custom dashboard tab or record form replacement)?
  → SPA Web Resource in MDA (or PCF for component-level)

Do you need full UI control + npm ecosystem + Power Platform governance,
and your users have Premium licenses, and mobile-web-only is acceptable?
  → Code App

Everything else — rapid prototyping, maker-built, multiple data sources?
  → Canvas App
```

---

## Official Limitations

From the [Microsoft Learn docs](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview) (as of February 2026):

| Limitation | Detail |
|---|---|
| **No mobile app support** | Browser-only. Not supported in Power Apps mobile (iOS/Android) or Power Apps for Windows. |
| **No Power Platform Git integration** | Can't use the built-in Power Platform Git integration feature. Use your own repo (like this one). |
| **No SAS IP restriction** | Storage Shared Access Signature IP restriction not yet supported. |
| **No Power BI integration** | `PowerBIIntegration` function not available. Can be embedded in Power BI via the Power Apps visual. |
| **No SharePoint forms** | Can't replace SharePoint list forms like Canvas Apps can. |
| **No schema refresh command** | Schema changes on a connector require delete + re-add of the data source. |
| **No connection creation via CLI** | Connections must be created first in the maker portal; CLI can only reference existing ones. |
| **Excel Online not yet supported** | Excel Online (Business) and Excel Online (OneDrive) connectors are excluded. |
| **Hosted bundle is public** | The compiled app code is on a publicly accessible endpoint. No secrets in app code. |
| **Browser local network access** | Chrome/Edge block localhost requests from public origins since Dec 2025. Users must grant permission on first local dev session. |
| **Premium license required** | Every end-user needs Power Apps Premium. No per-app licensing path. |
| **Sharing limits** | Follows Canvas App managed environment sharing limits. |

---

## Our Take

### The Genuine Value

The core value proposition is real: **auth, connectors, governance, and hosting as a service.** Setting up authentication (MSAL, app registrations, token handling) is genuinely painful in traditional web development. Building your own connector integrations is even more painful. Code Apps removes both problems entirely — you write React components, the platform handles the rest.

For organizations already deep in Power Platform (D365 Sales/Service, existing Dataverse data, established DLP policies), Code Apps slots in perfectly. The gap between "I need a custom dashboard" and "we need to spin up a new Azure-hosted app with its own auth" is now much smaller.

The connector ecosystem as a "data source as a service" argument is compelling. Hundreds of pre-built connectors, all authenticated and governed, callable from TypeScript — this is genuinely hard to replicate outside the platform.

### The Vibe Coding Angle

The most interesting signal from the community is how naturally Code Apps pairs with AI coding agents. Several developers report building complete working apps with GitHub Copilot agent mode faster than they ever could with Canvas Apps. The starter template is even explicitly described by Microsoft as "optimized for coding agents."

This is worth taking seriously. Canvas App's Power Fx and the drag-and-drop canvas are notoriously difficult for AI agents to work with — LLMs excel at generating TypeScript and React. Code Apps makes the AI agent the low-code layer, which is a fundamentally different and potentially more powerful abstraction than Power Fx. The prompt replaces the formula bar.

Microsoft's own [FluentSample](https://github.com/microsoft/PowerAppsCodeApps/tree/main/samples/FluentSample) is described as "entirely generated using GitHub Copilot." This is Microsoft openly dog-fooding the vibe-coding workflow.

### The Real Concerns

**Licensing math is brutal for small teams.** $20/user/month Premium for every user who opens the app is expensive if you're not already paying for it. A small 10-person team costs $200/month just for licenses, before any development cost. A plain Azure Static Web App with Entra auth is a fraction of that at scale. Do the math for your specific scenario before committing.

**Mobile is a significant gap.** "Runs in a browser" sounds fine until you realize it means not in the Power Apps mobile app — which your existing Canvas App users already have installed on their phones. This is a real blocker for field-facing scenarios.

**Microsoft product lifecycle risk.** The community has raised this directly: Code Apps has been generally available for less than six months. Microsoft has a history of evolving or sunsetting Power Platform features. The gap between the npm CLI path and the `pac code` path being deprecated simultaneously is a small but real sign of the platform still finding its feet. Bet on it for a new project, but document everything and keep your code as standard React as possible so it can be extracted if needed.

**Governance of AI-generated apps is uncharted.** When your colleague generates a full app in Copilot with no code review, what's the security posture? The DLP and Entra auth layers help — but this is a real governance question organizations haven't fully worked through yet.

### Overall Assessment

Code Apps is a strong fit for a specific, well-defined niche: **pro-code custom applications on top of Power Platform data, built by development teams, for internal users who already have Premium licenses.** For that use case, it's genuinely excellent — better developer experience than Canvas App, better UI flexibility than Model-Driven, and better governance than a DIY Azure app.

It is not a replacement for Canvas Apps (wrong audience), not a replacement for Model-Driven Apps (wrong use case), and not yet a real option for mobile-first or external-user scenarios.

The vibe-coding angle may prove to be its killer feature. If AI coding agents reach the point where non-developers can generate and maintain a Code App as easily as a Power Fx formula, the licensing cost becomes the only remaining question. Watch this space.

---

## Sources

| Source | URL |
|---|---|
| Power Apps Code Apps Overview (MS Learn) | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview) |
| Power Apps Code Apps Architecture (MS Learn) | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/architecture) |
| System Limits and Configuration (MS Learn) | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/system-limits-configuration) |
| `pac code` CLI Reference | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/code) |
| npm CLI Quickstart | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/npm-quickstart) |
| Connect to Data (MS Learn) | [learn.microsoft.com](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-data) |
| Official GitHub Repository | [github.com/microsoft/PowerAppsCodeApps](https://github.com/microsoft/PowerAppsCodeApps) |
| GA Announcement Blog Post (Feb 5, 2026) | [Microsoft Power Platform Blog](https://www.microsoft.com/en-us/power-platform/blog/power-apps/generally-available-host-and-run-code-apps-in-power-apps/) |
| Inside the New Power Apps (Nov 2025) | [Microsoft Power Platform Blog](https://www.microsoft.com/en-us/power-platform/blog/2025/11/18/inside-the-new-power-apps-the-future-of-app-development/) |
| GA Announcement — Aric Levin | [ariclevin.com](https://www.ariclevin.com/powerapps/post/code-apps-in-power-apps-are-now-generally-available-ga/) |
| DEV.to — Unlocking Pro-Code Potential | [dev.to](https://dev.to/seenakhan/code-apps-in-power-apps-unlocking-pro-code-potential-in-a-low-code-world-pkk) |
| pac CLI Code Commands Reference | [powerappsguide.com](https://powerappsguide.com/blog/post/pac-cli-code-commands-reference) |
| Reddit — "What's your opinion on Power Apps Code Apps?" | r/PowerApps (Sep 2025) |
| Reddit — "Power Apps code apps opinions?" | r/PowerApps (Dec 2025) |

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built by a CRM/Power Apps specialist learning in public. Issues and PRs welcome.*
