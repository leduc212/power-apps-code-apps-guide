# Chapter 1: Understanding the Paradigm

> **Blog post title:** Power Apps Code Apps: A CRM Developer's Guide to the New Code-First Approach
>
> **Audience:** Power Apps / Dynamics 365 developers who are comfortable with Canvas Apps or Model-Driven Apps and want to understand where Code Apps fits in.

---

## Introduction

If you've worked with Dynamics 365 or Power Apps for any length of time, you know the question well: *"Can we just make it look like this?"*

The client shows you a Figma mockup. You look at it. It's a custom dashboard with a multi-column layout, interactive charts, a sidebar with live record counts, and a filtered list that reacts to selections. You know what's coming - hours of hacking Canvas App controls into approximate positions, fighting layout constraints, and eventually compromising on something that "looks close enough."

That compromise has always been one of the frustrating realities of Power Platform development. Until now.

**Power Apps Code Apps** - which became generally available since February 2026 - is Microsoft's answer to that problem. It lets you build a real web application using your IDE, React, TypeScript, and Vite, and then publish it directly into Power Platform. Your app gets hosted on Power Platform's infrastructure, secured with Entra authentication, and given access to the same 1,500+ connectors and Dataverse data you've always worked with - all without giving up control over a single pixel of your UI.

This article is the first in a series where I walk through learning Code Apps as a CRM/Power Apps specialist. Before writing a single line of code, I want to establish the mental model that shapes everything: **what Code Apps is, what it isn't, and when you'd actually use it.**

---

## The Power Apps Family Tree (Briefly)

To understand where Code Apps sits, it helps to remember that "Power Apps" has never been one thing:

- **Canvas Apps** - drag-and-drop, formula-driven, highly flexible layout, connects to many data sources. Great for rapid prototyping and apps built by makers who aren't developers.
- **Model-Driven Apps** - data-first, driven entirely by your Dataverse schema. Forms, views, dashboards all come from the data model. Great for CRM-style line-of-business apps (and the foundation of Dynamics 365 itself).
- **Power Pages** - Canvas-like builder for external-facing portals and websites.

Now a fourth option joins:

- **Code Apps** - a real SPA (Single Page Application) built with standard web technologies (React, Vue, TypeScript) that is published to and hosted by Power Platform.

---

## What Code Apps Is

Think of it this way: **Code Apps brings Power Platform capabilities into a standard web app, rather than bringing standard web capabilities into Power Platform.**

The flow looks like this:

1. You write a TypeScript/React SPA in VS Code, just like any modern web project.
2. You install the `@microsoft/power-apps` SDK (an npm package).
3. You use the Power Platform CLI to connect your app to a Power Platform environment and add data sources (Dataverse tables, SharePoint, Azure SQL, etc.).
4. The SDK auto-generates TypeScript model and service files for each data source.
5. You use those generated services in your React components to read and write data.
6. When ready, you build the app and push it to Power Platform with one command.
7. It appears in Power Apps as an app that can be shared, governed, and managed just like a Canvas App.

Your users open it from make.powerapps.com or a direct link. They see your React app, fully authenticated, talking to Dataverse. They don't know or care that it's "code-first" - it's just an app.

### What the Platform Gives You for Free

The most important thing to understand is what you **don't** have to build:

| Concern | How Code Apps handles it |
|---|---|
| Authentication | Microsoft Entra, managed by the Power Apps host - zero config |
| Connector access | All 1,500+ Power Platform connectors, callable from TypeScript |
| Hosting and infrastructure | Power Platform hosts your built SPA - no Azure App Service needed |
| Data access governance | DLP policies apply automatically |
| Sharing and permissions | Same sharing model as Canvas Apps |
| ALM | Push to solutions, deploy with Power Platform Pipelines |
| Licensing | End-users need Power Apps Premium |

This is the core value proposition: **you write the UI and logic, Power Platform handles the rest.**

### The Architecture in Three Layers

At runtime, a Code App has three logical layers:

```
┌─────────────────────────────────────┐
│           Your Code                 │  React components, business logic,
│        (React / TypeScript)         │  routing, state management
├─────────────────────────────────────┤
│        Power Apps SDK               │  Generated services/models,
│    (@microsoft/power-apps)          │  connector API calls, context API
├─────────────────────────────────────┤
│        Power Apps Host              │  Entra auth, app loading,
│   (managed by Power Platform)       │  connector proxy, DLP enforcement
└─────────────────────────────────────┘
```

The SDK is the bridge. When you add a Dataverse table as a data source, the SDK's CLI generates typed TypeScript files for that table's schema - a model file and a service file. You import those into your components and call methods like `AccountsService.getAll()` or `AccountsService.create(newAccount)`. The SDK handles translating those calls through the Power Apps host to the actual connector.

---

## What Code Apps Is Not

Equally important is what Code Apps is **not**, because these confusions will come up.

### It is not PCF (Power Apps Component Framework)

PCF lets you build a custom code component - a single control (like a date picker, a chart, or a custom grid) that lives **inside** a Canvas App or Model-Driven App form. It is a component embedded in a Power App.

Code Apps **is** the Power App. The entire application is your code.

| | PCF | Code Apps |
|---|---|---|
| What it produces | A component/control | A full application |
| Where it runs | Inside a Canvas or Model-Driven App | Standalone, hosted by Power Platform |
| Who builds it | Developers extending existing apps | Developers building new apps from scratch |
| UI framework | Component-level | Full SPA |

### It is not an Azure-hosted web app

You could build a React app, connect it to Dataverse via the Web API, host it on Azure App Service, and register it with Entra. You'd have something functionally similar. But you'd also be responsible for infrastructure, auth config, connector setup, and governance - none of which is trivial in an enterprise.

Code Apps removes all of that. You write code, you push, Power Platform takes care of the rest, and your app inherits your organization's Power Platform governance policies automatically.

### It is not a Canvas App with code

Canvas Apps have formula-based logic (Power Fx) and a drag-and-drop canvas. Code Apps have none of that. There is no canvas, no Power Fx, no maker portal. You open VS Code, write TypeScript, and use npm. It is a code-first tool for developers.

---

## The Decision Framework: Canvas App vs Model-Driven vs Code Apps

This is the practical question every Dynamics 365/Power Apps developer needs to answer when a new requirement comes in.

### Use a Model-Driven App when:
- The UI is primarily **forms, views, and dashboards driven by your Dataverse schema**
- You need deep Dynamics 365 integration (timeline, activity feeds, business process flows, out-of-box commands)
- Your users are internal CRM users who are familiar with the standard Dynamics UI
- Configuration over code is preferred

**Example:** A standard sales CRM for your D365 sales team. Opportunity forms, Account views, pipeline dashboards via built-in charts.

### Use a Canvas App when:
- You need a **custom layout** but the complexity is manageable within the drag-and-drop paradigm
- You need to connect multiple non-Dataverse data sources
- Your users are operational (field workers, approvers, mobile users)
- You want makers (non-developers) to be able to modify the app over time

**Example:** A field technician mobile app that reads work orders from Dataverse and writes to SharePoint.

### Use a Code App when:
- You need **full control over the UI** that Canvas App cannot deliver
- You want to use **standard web libraries** (charting libraries, UI component libraries, routing, state management)
- The app is **complex enough** that a proper SPA architecture is warranted
- Your team has front-end development skills and wants to work in a real dev workflow (IDE, git, npm, CI/CD)
- The app needs to feel like a **custom web product**, not like "a Power App"

**Example:** A custom sales analytics portal with pipeline visualization, territory maps, and complex filtering - built on top of live Dataverse data, governed by Power Platform policies, deployed with Power Platform Pipelines.

### The Honest Overlap

There is genuine overlap between these options and the lines will continue to blur as the platform evolves. Some guiding instincts:

- If a skilled maker can build it in Canvas App without excessive workarounds, use Canvas App.
- If it's primarily forms and views on Dataverse data, use Model-Driven.
- If it requires a development team, a git repo, and something that looks and behaves like a modern web application, use Code Apps.

---

## Why This Matters for CRM Developers Specifically

For Dynamics 365 specialists, Code Apps opens a door that hasn't existed before: **building custom front-ends on top of Dataverse without leaving the Power Platform governance boundary.**

Previously, if a client wanted a truly custom UI on their CRM data, the options were:
1. Push Canvas App to its limits (and compromise on UX)
2. Build a custom Azure-hosted web app (and take on full infrastructure ownership)
3. Build a Power Pages portal (limited to external-facing, specific scenarios)

Code Apps is now option 4: build whatever you want in code, stay inside Power Platform, inherit all the governance and connector infrastructure you've already built.

That's a meaningful addition to the toolkit.

---

## What's Next

In Chapter 2, I'll go hands-on: scaffolding the project from the official Vite template, initializing it as a Code App, running it locally, and pushing it to a Power Platform environment for the first time.

The project I'll build throughout this series is a **CRM Sales Hub** - a custom sales management app connected to Dynamics 365 Dataverse data. By the end of the series, it will have account/opportunity/contact CRUD, a pipeline dashboard with charts, context-aware personalization (filtering by logged-in user), and proper ALM with solutions and pipelines.

---

## Key Takeaways

- Power Apps Code Apps lets you build a real SPA (React/TypeScript/Vite) and publish it to Power Platform
- The platform provides authentication, connectors, hosting, governance, and ALM - you provide the code
- It is **not** PCF, not an Azure web app, and not a Canvas App with code
- Use it when you need full UI control, modern front-end tooling, and Power Platform governance
- For CRM specialists: it's a way to build custom UIs on Dataverse without leaving the Power Platform boundary

---

*Next: Chapter 2 - Hello World & Tooling*
