# Chapter 2: Hello World & Tooling

> **Blog post title:** Your First Power Apps Code App: From Zero to Live in Power Platform
>
> **Audience:** Power Apps / Dynamics 365 developers following along from Chapter 1. You understand what Code Apps is. Now you build one.
>
> **Updated September 2026** for SDK 1.4 and the Power Apps CLI (`pa`). The original February text is at the [`v1-feb-2026`](https://github.com/leduc212/power-apps-code-apps-guide/tree/v1-feb-2026) tag.

---

## Introduction

Chapter 1 was the mental model. Chapter 2 is where we get our hands dirty.

The goal is simple: get a working Code App, even a blank one, running locally and then published to Power Platform. This chapter is about the tooling and what each step actually does. No CRM data yet.

---

## Prerequisites

| Tool | Why you need it |
|---|---|
| [Node.js LTS](https://nodejs.org/) | Runtime for npm and the build tooling |
| [Git](https://git-scm.com/) | Used by `degit` to scaffold the template |
| Power Apps CLI (`pa`) | Sign in, initialize, add data sources, publish |
| VS Code (or your IDE of choice) | Where you write the code |

Install the CLI globally:

```bash
npm install --global @microsoft/power-apps-cli
```

Or skip the global install and run it on demand by writing `npx -p @microsoft/power-apps-cli pa` wherever this series writes `pa`.

You also need a **Power Platform environment with Code Apps enabled**. An admin turns it on per environment:

1. [Power Platform admin center](https://admin.powerplatform.microsoft.com) > **Manage** > **Environments** > select the environment
2. **Settings** > **Product** > **Features**
3. **Power Apps code apps** > toggle **Enable code apps** > **Save**

Admins can also set this for many environments at once with environment groups and rules. If you aren't an admin, this is the first blocker you'll hit, and there's no workaround.

> **A short history of the CLI.** If you read older tutorials (including the February version of this series) you'll see `pac code init`, `pac code add-data-source`, `npx power-apps init` and `npx power-apps push`. At GA there were two CLIs: the Power Platform CLI's `pac code` commands, and an npm-based `power-apps` CLI that was replacing them. By September 2026 both have been superseded by a single CLI, `pa`, with grouped commands (`pa app ...`, `pa auth ...`, `pa connection ...`). You no longer need `pac` to build a Code App. The concepts carry over; only the commands changed.

---

## Step 1: Scaffold the Project

Microsoft maintains two templates in the [PowerAppsCodeApps repo](https://github.com/microsoft/PowerAppsCodeApps/tree/main/templates):

- `templates/starter` (recommended): Vite + React + TypeScript + Tailwind + TanStack Query + React Router, with the Power Apps Vite plugin already wired in
- `templates/vite`: a minimal `npm create vite` project configured for Code Apps

For the CRM Sales Hub we use **starter**: routing for multiple screens, TanStack Query for data fetching and Tailwind for styling, out of the box.

```bash
npx degit github:microsoft/PowerAppsCodeApps/templates/starter crm-sales-hub
cd crm-sales-hub
npm install
```

`degit` copies the template folder without its git history, so you start clean. At this point it's a standard Vite + React + TypeScript project with two Power Apps-specific packages: the `@microsoft/power-apps` client library and the `@microsoft/power-apps-vite` plugin.

The template's `package.json` lags behind the library (in September 2026 it still asked for `^1.2.5` while 1.4.0 was out). Move both packages to the latest version right away:

```bash
npm install @microsoft/power-apps@latest
npm install --save-dev @microsoft/power-apps-vite@latest
```

---

## Step 2: Sign In and Initialize

```bash
pa auth login
pa app init --display-name "CRM Sales Hub" --environment-id <your-environment-id>
```

`pa auth login` opens the browser for Entra sign-in. The CLI caches the account, so you do this once per machine. `pa auth status` shows which account is active, and `pa auth switch` changes it.

`pa app init` registers the project against an environment. Run it without flags and it prompts you instead. The environment ID is in the admin center URL when you select the environment.

> **Check the account before every push.** If you work across tenants (a client's and your own, say), `pa auth status` is the first thing to run. The CLI will happily push to whichever environment the active account points at.

### What Changed After Init

One new file appears in the project root: `power.config.json`. Trimmed, it looks like this:

```json
{
  "version": "1.0",
  "appId": "<app-id>",
  "appDisplayName": "CRM Sales Hub",
  "environmentId": "<your-environment-id>",
  "buildPath": "./dist",
  "buildEntryPoint": "index.html",
  "connectionReferences": {},
  "databaseReferences": {}
}
```

It records which app, in which environment, uses which data sources. The CLI owns it: `pa app add data-source`, `pa app add flow` and `pa app set-setting` all write to it. Treat it as CLI-managed and edit it by hand only for a documented fix.

It holds no secrets. Commit it in your own project. (This guide's demo doesn't commit it, because every reader points the app at a different environment.)

---

## Step 3: Run Locally

```bash
npm run dev
```

The starter template's `vite.config.ts` includes the Power Apps Vite plugin:

```typescript
import { powerApps } from '@microsoft/power-apps-vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    powerApps()    // <- serves the app and the connector config on one port
  ],
  ...
})
```

The plugin runs the Power Apps local host inside the Vite dev server, so one command serves both your app and the config the host needs. The output includes a **Local Play** URL:

```
  ➜  Local Play:   https://apps.powerapps.com/play/e/<env-id>/a/local?_localAppUrl=http://localhost:5173/&_localConnectionUrl=...
  ➜  Local:        http://localhost:5173/
```

> **Using the minimal `vite` template?** It doesn't include the plugin. Run `npm run dev` for the app and `pa app run` for the local host, which prints the Local Play URL.

### Open the Local Play URL, not localhost

Opening `localhost:5173` directly skips the Power Apps host: no sign-in, no connectors. Always open the Local Play URL, which loads your local app inside the real host.

Two things to watch:

**1. Local network access.** Chrome and Edge block requests from public sites (the Power Apps host) to `localhost` by default. The browser prompts you to allow local network access; click **Allow**. On managed devices the prompt may be blocked by policy, so ask IT about the local network access settings. If you embed the app in an iframe during development, the iframe needs `allow="local-network-access"`.

**2. Same browser profile.** Open the URL in the browser profile that is signed in to your Power Platform tenant. The host uses that session; a different profile means a different identity and a confusing failure.

### What You Should See

Your React app inside the Power Apps player: the Power Apps header across the top, the starter template's placeholder page below it. You're now running a local React app against real Power Platform infrastructure, with authentication handled for you.

---

## Step 4: Build and Publish

```bash
npm run build
pa app push
```

- `npm run build` type-checks and bundles the app into `./dist`
- `pa app push` uploads `./dist` and registers a new version of the app

On success the CLI prints the app's play URL. The app also appears under **Apps** in [make.powerapps.com](https://make.powerapps.com), next to your Canvas Apps.

Pushing doesn't give anyone else access. Share it from the maker portal, or from the CLI:

```bash
pa app share --principal colleague@contoso.com
```

### Optional: Hide the Power Apps Header

Power Apps draws its own header bar above your app. If your app has its own header, hide the Power Apps one for all users:

```bash
pa app set-setting --show-header false
pa app push
```

Or hide it for one link only by adding `?hideNavBar=true` to the play URL.

---

## What Just Happened (Under the Hood)

```
pa auth login        -> caches your Entra sign-in for the CLI
pa app init          -> writes power.config.json (app + environment)

npm run dev          -> Vite dev server on port 5173; the powerApps() plugin
                        also serves the local host config the player needs

npm run build        -> compiles the SPA into static files in ./dist

pa app push          -> uploads ./dist and publishes a new app version
```

The Power Apps host is what makes this different from deploying a React app to Azure Static Web Apps. The host:

- Signs the user in before your code loads
- Proxies every connector call your app makes through the client library
- Enforces DLP policies on those calls
- Shows consent dialogs for connections when needed

Your bundle has no auth code: no MSAL, no tokens, no API keys. Your components call `AccountsService.getAll()` and data comes back.

---

## What the Starter Template Gives You

| Library | Role |
|---|---|
| **Vite** | Build tool and dev server with hot module reload |
| **React + TypeScript** | UI framework with type safety |
| **React Router** | Routing between pages (Accounts, Dashboard, ...) |
| **TanStack Query** | Data fetching, caching, loading and error states |
| **Tailwind CSS** + shadcn/ui components | Styling and UI building blocks |

For a CRM app with multiple screens and a lot of data fetching, these are the right defaults. TanStack Query in particular does a lot of the work from Chapter 3 onward.

> **Other UI libraries work too.** The starter uses Tailwind and shadcn/ui. My production app used Fluent UI v9 instead, because it had to look like the Microsoft 365 apps its users already knew. Any React component library works; pick the one that fits your users.

---

## Key Takeaways

- Install the CLI with `npm install --global @microsoft/power-apps-cli`, or run it through `npx`. You don't need `pac`.
- Scaffold with `npx degit github:microsoft/PowerAppsCodeApps/templates/starter`
- `pa auth login`, then `pa app init`, which writes `power.config.json`. The CLI owns that file.
- With the starter template, `npm run dev` is the only command for local development
- Open the **Local Play** URL, not localhost, in the browser profile signed in to your tenant, and allow local network access
- `npm run build`, then `pa app push` to publish; share with `pa app share` or from the maker portal
- Run `pa auth status` before every push when you work across tenants

---

## What's Next

In Chapter 3 we add real CRM data: the Account, Contact and Opportunity tables from Dataverse, the TypeScript files the CLI generates for them, and the first real screen, an Accounts list with search.

---

*Previous: Chapter 1 - Understanding the Paradigm*
*Next: Chapter 3 - Connecting to Dataverse*
