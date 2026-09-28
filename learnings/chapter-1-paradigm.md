# Chapter 1: Understanding the Paradigm

> **Blog post title:** Power Apps Code Apps: A CRM Developer's Guide to the New Code-First Approach
>
> **Audience:** Power Apps / Dynamics 365 developers who are comfortable with Canvas Apps or Model-Driven Apps and want to understand where Code Apps fits in.
>
> **Updated September 2026** for SDK 1.4 and the Power Apps CLI (`pa`). The original February text is at the [`v1-feb-2026`](https://github.com/leduc212/power-apps-code-apps-guide/tree/v1-feb-2026) tag.

---

## Introduction

If you've worked with Dynamics 365 or Power Apps for any length of time, you know the question well: *"Can we just make it look like this?"*

The client shows you a Figma mockup. It's a custom dashboard with a multi-column layout, interactive charts, a sidebar with live record counts, and a filtered list that reacts to selections. You know what's coming: hours of hacking Canvas App controls into approximate positions, fighting layout constraints, and settling on something that "looks close enough."

That compromise has always been one of the frustrating realities of Power Platform development. Until now.

**Power Apps Code Apps**, generally available since February 2026, is Microsoft's answer to that problem. You build a real web application in your IDE with React, TypeScript and Vite, then publish it into Power Platform. The app is hosted on Power Platform's infrastructure, secured with Entra authentication, and has access to the same 1,500+ connectors and Dataverse data you've always worked with, without giving up control over a single pixel of your UI.

This series started as my notes from learning Code Apps at GA. Since then I've shipped a production Code App: a migration of a large Canvas App with tens of thousands of lines of Power Fx. This update keeps the learning-journey structure but corrects what I got wrong and what the platform has changed since.

Before writing a single line of code, this chapter establishes the mental model that shapes everything: **what Code Apps is, what it isn't, and when you'd actually use it.**

---

## The Power Apps Family Tree (Briefly)

"Power Apps" has never been one thing:

- **Canvas Apps**: drag-and-drop, formula-driven, flexible layout, many data sources. Great for rapid prototyping and apps built by makers who aren't developers.
- **Model-Driven Apps**: data-first, driven entirely by your Dataverse schema. Forms, views and dashboards all come from the data model. Great for CRM-style line-of-business apps, and the foundation of Dynamics 365 itself.
- **Power Pages**: a builder for external-facing portals and websites.

A fourth option now sits alongside them:

- **Code Apps**: a real SPA (Single Page Application) built with standard web technologies (React, Vue, TypeScript) that is published to and hosted by Power Platform.

---

## What Code Apps Is

Think of it this way: **Code Apps brings Power Platform capabilities into a standard web app, rather than bringing standard web capabilities into Power Platform.**

The workflow:

1. You write a TypeScript/React SPA in VS Code, like any modern web project.
2. The project depends on the `@microsoft/power-apps` client library (an npm package).
3. You use the **Power Apps CLI** (`pa`) to connect the app to a Power Platform environment and add data sources: Dataverse tables, SharePoint lists, SQL, Office 365, Power Automate flows.
4. The CLI generates typed TypeScript model and service files for each data source.
5. Your React components call those generated services to read and write data.
6. You build the app and publish it with `pa app push`.
7. It appears in Power Apps as an app that can be shared, governed and managed like a Canvas App.

Users open it from make.powerapps.com or a direct link. They see your React app, already signed in, talking to Dataverse. They don't know or care that it's "code-first". It's just an app.

### What the Platform Gives You for Free

The most important thing to understand is what you **don't** have to build:

| Concern | How Code Apps handles it |
|---|---|
| Authentication | Microsoft Entra, managed by the Power Apps host. Zero config. |
| Connector access | Power Platform connectors, callable from TypeScript through generated services |
| Hosting | Power Platform hosts your built SPA. No Azure App Service needed. |
| Governance | DLP, Conditional Access (including per-app), sharing limits, app quarantine and tenant isolation apply as they do to Canvas Apps |
| Sharing | Same sharing model as Canvas Apps, from the maker portal or `pa app share`. Guest users via Azure B2B. |
| ALM | Apps live in solutions; connection references and environment variables make them portable between environments |
| Licensing | End users need Power Apps Premium, **or** an App Pass, pay-as-you-go, or auto-claim of an available Premium licence |

The deal is straightforward: **you write the UI and logic, Power Platform handles the rest.**

> **What changed since February:** at GA, licensing was Premium only and external users weren't supported. Both have loosened. Check the [overview page](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview) for the current list before you quote costs to a client.

### The Architecture in Three Layers

At runtime, a Code App has three logical layers:

```
┌─────────────────────────────────────┐
│           Your Code                 │  React components, business logic,
│        (React / TypeScript)         │  routing, state management
├─────────────────────────────────────┤
│     Power Apps client library       │  Generated services/models,
│    (@microsoft/power-apps)          │  connector calls, context API
├─────────────────────────────────────┤
│        Power Apps Host              │  Entra auth, app loading,
│   (managed by Power Platform)       │  connector proxy, DLP enforcement
└─────────────────────────────────────┘
```

The client library is the bridge. When you add a Dataverse table as a data source, the CLI generates typed files for that table: a model and a service. You import those into your components and call methods like `AccountsService.getAll()` or `AccountsService.create(newAccount)`. The library routes each call through the Power Apps host to the connector.

---

## What Code Apps Is Not

These confusions come up constantly.

### It is not PCF (Power Apps Component Framework)

PCF lets you build a custom code component: a single control (a date picker, a chart, a custom grid) that lives **inside** a Canvas App or Model-Driven App form.

Code Apps **is** the Power App. The entire application is your code.

| | PCF | Code Apps |
|---|---|---|
| What it produces | A component/control | A full application |
| Where it runs | Inside a Canvas or Model-Driven App | Standalone, hosted by Power Platform |
| Who builds it | Developers extending existing apps | Developers building new apps |
| UI framework | Component-level | Full SPA |

### It is not an Azure-hosted web app

You could build a React app, call the Dataverse Web API, host it on Azure App Service and register it with Entra. Functionally similar, but you'd own the infrastructure, auth configuration, connector plumbing and governance, none of which is trivial in an enterprise.

Code Apps removes all of that, and your app inherits your organization's Power Platform governance automatically.

### It is not a Canvas App with code

There is no canvas, no Power Fx and no drag-and-drop designer. You open VS Code, write TypeScript and use npm. There is also **no converter** from Canvas to Code: moving an existing Canvas App means rewriting its UI and logic. That rewrite gets its own chapter in Part 2.

---

## The Decision Framework

This is the practical question for every new requirement.

### Use a Model-Driven App when:
- The UI is mainly **forms, views and dashboards driven by your Dataverse schema**
- You need deep Dynamics 365 integration (timeline, business process flows, out-of-box commands)
- Configuration is preferred over code

**Example:** a standard sales CRM for your D365 sales team.

### Use a Canvas App when:
- You need a **custom layout** but the complexity is manageable in the drag-and-drop model
- Your users work **on phones in the Power Apps mobile app**
- Makers (not developers) will maintain the app over time

**Example:** a field technician app that reads work orders from Dataverse and writes to SharePoint.

### Use a Code App when:
- You need **full control over the UI** that Canvas can't deliver
- You want **standard web libraries**: charting, component libraries, routing, state management
- The app is **complex enough** to justify a proper SPA architecture, git history and code review
- Your team has front-end skills, or works with an AI coding agent and a reviewer
- Users open it in a **browser**

**Example:** a sales analytics portal with pipeline visualization and complex filtering, on live Dataverse data.

### The mobile question

Code Apps run in the browser, including mobile browsers, but **not inside the Power Apps mobile app** or Power Apps for Windows. If your users live in the mobile app, that's a Canvas or Model-Driven requirement. Microsoft also has a separate preview for **native mobile apps** (React Native/Expo, standalone iOS/Android apps). It's a different product from Code Apps and out of scope for this series.

### The honest overlap

The lines blur, and will keep blurring:

- If a skilled maker can build it in Canvas without excessive workarounds, use Canvas.
- If it's mainly forms and views on Dataverse data, use Model-Driven.
- If it needs a development team, a git repo and something that behaves like a modern web application, use Code Apps.

---

## Why This Matters for CRM Developers Specifically

For Dynamics 365 specialists, Code Apps opens a door that didn't exist before: **custom front-ends on top of Dataverse without leaving the Power Platform governance boundary.**

Previously, if a client wanted a truly custom UI on their CRM data, the options were:
1. Push Canvas to its limits (and compromise on UX)
2. Build a custom Azure-hosted web app (and own the infrastructure)
3. Build a Power Pages portal (external-facing scenarios only)

Code Apps is option 4: build whatever you want in code, stay inside Power Platform, and inherit the governance and connectors you already have.

---

## What's Next

The series is now in two parts.

**Part 1: Foundations** builds the **CRM Sales Hub**, a sales app on the standard Dynamics 365 Account, Contact and Opportunity tables:

- **Chapter 2:** scaffold, run locally and publish with the `pa` CLI
- **Chapter 3:** add Dataverse tables and build an Accounts list
- **Chapter 4:** account detail, create and delete opportunities
- **Chapter 5:** a dashboard with charts
- **Chapter 6:** user context and moving between environments

**Part 2: Production** covers what I only learned by shipping a real migration: paging large tables, calling Power Automate flows, releasing and supporting the app, rebuilding a Canvas App in code, and working with an AI coding agent.

---

## Key Takeaways

- Code Apps lets you build a real SPA (React/TypeScript/Vite) and publish it to Power Platform
- The platform provides authentication, connectors, hosting, governance and ALM; you provide the code
- It is **not** PCF, not an Azure web app, and not a Canvas App with code, and there is no Canvas-to-Code converter
- Use it for full UI control, modern front-end tooling and Power Platform governance, in the browser
- Licensing is no longer Premium-only: App Pass, pay-as-you-go and auto-claim also work

---

*Next: Chapter 2 - Hello World & Tooling*
