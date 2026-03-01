# Chapter 2: Hello World & Tooling

> **Blog post title:** Your First Power Apps Code App: From Zero to Live in Power Platform
>
> **Audience:** Power Apps / Dynamics 365 developers following along from Chapter 1. You understand what Code Apps is. Now you build one.

---

## Introduction

In Chapter 1, I covered the mental model: what Code Apps is, what it is not, and when you would reach for it over Canvas App or Model-Driven App. No code, just concepts.

Chapter 2 is where we get our hands dirty.

The goal is simple: get a working Code App - even a blank one - running locally and then published to Power Platform. This chapter is entirely about the tooling, the workflow, and understanding what each step actually does. No CRM data yet, no fancy UI. Just the foundation that everything else builds on.

By the end, you will have a Code App live in your Power Platform environment that you built from scratch in your IDE.

---

## Prerequisites

Before running a single command, make sure you have these installed:

| Tool | Why you need it |
|---|---|
| [Node.js LTS](https://nodejs.org/) | Runtime for npm and all build tooling |
| [Git](https://git-scm.com/) | Required by `degit` to scaffold the template |
| [Power Platform CLI (PAC)](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction) | Needed for `pac auth` and `pac code add-data-source` (Chapters 3+) |
| VS Code (or your IDE of choice) | Where you write the code |

You also need a **Power Platform environment with Code Apps enabled**. If you are an environment admin:

1. Go to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com)
2. Environments > select your environment > Settings > Product > Features
3. Find **Power Apps code apps** and toggle **Enable code apps** on

If you are not an admin, you need someone with that access to flip the toggle before you can push or run apps connected to that environment.

---

## A Quick Note on Two CLIs

You will see two sets of CLI commands in the official documentation:

**Option A - PAC CLI (`pac code` commands):**
```bash
pac code init
pac code push
```

**Option B - npm CLI (`npx power-apps` commands, new as of SDK v1.0.4):**
```bash
npx power-apps init
npx power-apps run
npx power-apps push
```

The npm CLI is the newer approach and will **replace** the `pac code` commands in a future release. It has fewer prerequisites (you do not need PAC CLI installed just to run the app). Microsoft's docs already recommend it.

I will use the **npm CLI** throughout this series. But I will call out the PAC CLI equivalent where it matters, because you will see both in existing tutorials and GitHub issues.

---

## Step 1: Scaffold the Project

Microsoft maintains two starter templates on GitHub:

- `templates/vite` - minimal Vite setup, good for understanding the basics
- `templates/starter` - Vite + React + Tailwind CSS + Tanstack Query + React Router (recommended for real apps)

For the CRM Sales Hub we will build throughout this series, the **starter** template is the right choice. It gives us routing (for multiple screens), data fetching (Tanstack Query), and styling (Tailwind) out of the box.

Run this in your terminal from the parent directory where you want the project to live:

```bash
npx degit github:microsoft/PowerAppsCodeApps/templates/starter crm-sales-hub
cd crm-sales-hub
```

`degit` clones the template folder directly without copying the git history, so you start with a clean slate.

### What You Get

Open the folder in VS Code. The structure looks like this:

```
crm-sales-hub/
├── public/
├── src/
│   ├── App.tsx          <- root component
│   ├── main.tsx         <- entry point
│   └── ...
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

At this point it is a completely standard Vite + React + TypeScript project. There is nothing Power Platform-specific yet. That comes in the next step.

---

## Step 2: Install Dependencies and Initialize

Install dependencies including the Power Apps SDK:

```bash
npm install
npm install @microsoft/power-apps
```

Now initialize it as a Code App:

```bash
npx power-apps init
```

This command does two things:
1. **Authenticates you** with your Power Platform tenant (a browser window opens for Entra sign-in)
2. **Asks for your environment** and **a display name** for the app, then writes that metadata into the project

You can also pass the values directly to skip the interactive prompts:

```bash
npx power-apps init --displayName "CRM Sales Hub" --environmentId <your-environment-id>
```

To find your environment ID: go to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com) > Environments > select your environment > the ID is in the URL.

### What Changed After Init

After running `init`, one new file appears in the project root:

```
crm-sales-hub/
├── power.config.json    <- NEW
└── ...
```

Open `power.config.json`. It looks something like this:

```json
{
  "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "displayName": "CRM Sales Hub",
  "environmentId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "connections": []
}
```

**Important:** Do not edit this file manually. It is owned by the SDK and CLI - both use it to know which app in which environment you are working with. The `connections` array will grow automatically as you add data sources in Chapter 3.

This file should be committed to git. It does not contain secrets - just metadata.

---

## Step 3: Run Locally

```bash
npm run dev
```

That is the only command you need. The output looks like this:

```
  Power Apps Vite Plugin

  ➜  Local Play:   https://apps.powerapps.com/play/e/<env-id>/a/local?_localAppUrl=http://localhost:5173/&_localConnectionUrl=http://localhost:5173/__vite_powerapps_plugin__/power.config.json

  VITE v7.x.x  ready in 597 ms

  ➜  Local:   http://localhost:5173/
```

### Why Just One Command?

The `starter` template includes the `powerApps()` Vite plugin (from `@microsoft/power-apps-vite`). Look at `vite.config.ts`:

```typescript
import { powerApps } from '@microsoft/power-apps-vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    powerApps()    // <- this does the heavy lifting
  ],
  ...
})
```

This plugin integrates the Power Apps SDK connection server directly into the Vite dev server. Both your React app and the connector config endpoint run on the same port (5173). That is why the Local Play URL points to `localhost:5173` for both `_localAppUrl` and `_localConnectionUrl`.

> **Note for the minimal `vite` template:** If you scaffold from `templates/vite` instead of `templates/starter`, the `powerApps()` plugin is not included. In that case you do need two terminals - `npx power-apps run` in one and `npm run dev` in another. The `starter` template is recommended precisely because the plugin simplifies this.

### Open the Local Play URL

Copy the Local Play URL from the terminal output and open it in your browser:

```
https://apps.powerapps.com/play/e/<env-id>/a/local?_localAppUrl=http://localhost:5173/&_localConnectionUrl=http://localhost:5173/__vite_powerapps_plugin__/power.config.json
```

Two things to watch out for:

**1. Browser local network access prompt**

Since December 2025, Chrome and Edge block requests from public origins (the Power Apps host) to local endpoints (your localhost) by default. The browser will prompt you to allow local network access. Click **Allow**.

If the prompt does not appear on a managed device, check:
- Edge: `edge://flags/#local-network-access-permission`
- Chrome: [Local Network Access permission prompt](https://developer.chrome.com/blog/local-network-access)

**2. Same browser profile**

Open the Local Play URL in the same browser profile that is signed into your Power Platform tenant. The host relies on the existing Entra session - a different profile means a different identity and auth will fail silently.

### What You Should See

A blank app rendered inside the Power Apps player shell - the header and navigation chrome of Power Apps, with your React app loaded inside it. For the starter template, this is a simple placeholder screen.

You are now running a React TypeScript app locally, talking to Power Platform infrastructure, with Entra authentication handled automatically.

---

## Step 4: Build and Push to Power Platform

When you are ready to publish:

```bash
npm run build
npx power-apps push
```

- `npm run build` compiles TypeScript and bundles the app with Vite (output goes to `/dist`)
- `npx power-apps push` uploads that `/dist` bundle to Power Platform and registers it as an app

On success, the CLI prints a URL:

```
App URL: https://apps.powerapps.com/play/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Open that URL. Your app is now live, hosted by Power Platform, fully authenticated. You can navigate to [make.powerapps.com](https://make.powerapps.com), go to **Apps**, and you will see **CRM Sales Hub** in the list alongside your Canvas Apps.

From there you can share it with other users the same way you share any Power App.

---

## What Just Happened (Under the Hood)

To connect what we did to the architecture from Chapter 1:

```
npm run dev          -> starts Vite on port 5173
                        powerApps() plugin handles both:
                          - your React app (hot module reload)
                          - SDK connection endpoint (/__vite_powerapps_plugin__/power.config.json)

npm run build        -> compiles your React/TypeScript SPA into static assets (/dist)

npx power-apps push  -> uploads /dist to Power Platform, registers it as an app record
```

The Power Apps host is what makes this different from just deploying a React app to Azure Static Web Apps. The host:

- Handles Entra authentication before your code even loads
- Acts as a proxy for all connector calls your app makes through the SDK
- Enforces DLP policies on those calls
- Shows your organization's standard error/consent dialogs if needed

Your compiled SPA has no auth code in it. No MSAL, no token handling, no API keys. The host deals with all of that. Your React components just call `AccountsService.getAll()` and data comes back.

---

## A Note on the Two-Command Build + Push

You will also see this pattern in the official docs:

```bash
npm run build | pac code push
```

This pipes the build output into the push command in a single line. It works but it is the PAC CLI version. With the npm CLI you run them as two sequential commands:

```bash
npm run build
npx power-apps push
```

Same result, slightly cleaner mental model since you can see each step separately.

---

## What the Starter Template Gives You

Here is what the template set up. You will build on top of all of it:

| Library | Role |
|---|---|
| **Vite** | Build tool and dev server - fast hot module reload |
| **React + TypeScript** | UI framework with full type safety |
| **React Router** | Client-side routing between pages (Accounts, Opportunities, Dashboard, etc.) |
| **Tanstack Query** | Data fetching, caching, loading/error states for async calls |
| **Tailwind CSS** | Utility-first CSS - style components directly in JSX without writing CSS files |

For a CRM app with multiple screens, filtering, and data fetching, these choices are exactly right. Tanstack Query in particular is going to do a lot of heavy lifting when we start querying Dataverse in Chapter 3.

---

## Key Takeaways

- Scaffold with `npx degit github:microsoft/PowerAppsCodeApps/templates/starter`
- `npx power-apps init` authenticates you and writes `power.config.json` - do not edit it manually
- Local development with the `starter` template is a single command: `npm run dev` - the `powerApps()` Vite plugin handles both the app and the SDK connection endpoint on port 5173
- Use the **Local Play URL** printed by `npm run dev`, not raw localhost - open it in the same browser profile as your Power Platform tenant
- Allow the browser's local network access prompt when it appears - Chrome/Edge restriction since December 2025
- `npm run build` then `npx power-apps push` compiles and publishes to Power Platform
- Your app appears in make.powerapps.com alongside Canvas Apps and can be shared the same way
- The Power Apps host handles authentication and connector proxying - your code has no auth logic in it

---

## What's Next

In Chapter 3, I add real CRM data. We connect the app to Dataverse, add Account, Opportunity, and Contact as data sources, and look at the TypeScript models and service files the SDK generates. Then we build the first real screen: an Accounts list with search and filtering.

---

*Previous: Chapter 1 - Understanding the Paradigm*
*Next: Chapter 3 - Connecting to Dataverse*
