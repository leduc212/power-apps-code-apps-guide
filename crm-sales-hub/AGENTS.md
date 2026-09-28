# CRM Sales Hub: Rules for Coding Agents

A Power Apps Code App (React 19, TypeScript, Vite, TanStack Query, Tailwind + shadcn/ui) on the standard Dynamics 365 `account`, `contact` and `opportunity` tables. It's the demo for the guide in `../learnings/`; each pattern below is explained in the chapter named next to it.

## Hard rules

1. **Never edit `src/generated/` or `.power/`.** They are written by the Power Apps CLI. To change them, the human runs `pa app refresh data-source` (or `pa app add data-source` / `pa app add flow`), and you review the diff.
2. **Don't invent SDK methods.** Check every call against the generated service in `src/generated/services/`. If it isn't there, it doesn't exist.
3. **Every service call goes through `unwrap()`** (`src/lib/dataverse.ts`). Services resolve failures with `{ success: false }` instead of throwing. (Chapter 3)
4. **Every Dataverse query sets `select`.** Lists use `usePagedQuery` (`maxPageSize` + `skipToken`); complete lists use `fetchAllPages`. Never use `top` for paging, and never `skip`. (Chapter 7)
5. **User input in an OData filter goes through `odataString()`.** (Chapter 3)
6. **No direct HTTP.** `fetch`, `axios` and Graph calls don't work at runtime in a Code App. All external data goes through connectors or flows. (Chapter 8)
7. **No secrets in the code.** The built bundle is publicly downloadable.
8. **Related data without `$expand`:** read names with `formattedValue()`; fetch other columns with one `fetchByIds()` query, never one query per row. (Chapter 7)
9. **Writes send only the fields that changed**, with numbers as numbers (`Number()`). (Chapter 4)
10. **Long-running work** (flows, exports) runs through `useJobs` (`src/state/jobs.ts`), not inside a component. (Chapter 8)

## What the human does, not you

- **Sign-ins:** `pa auth login`, `pa app init`, and anything else that opens a browser.
- **Anything that touches an environment:** `pa app add ...`, `pa app refresh ...`, `pa app push`, sharing, and any change in the maker portal or Power Automate.
- **Deploying.** When you finish, say what you changed and that it is **not deployed**.

If a task needs platform work (a new column, a flow change) before app work, write the plan with the human's steps and your steps separated, and wait for the human to say the platform side is done.

## Before you say it's done

- `npm run build` passes (this type-checks).
- `npm run lint` shows nothing new. (Three existing `react-refresh/only-export-components` errors in `src/components/ui/badge.tsx`, `button.tsx` and `src/providers/theme-provider.tsx` come from the shadcn/ui template; leave them.)
- Every new query and mutation has a visible error path.
- You've said what you could **not** verify. Nothing here can be run against Dataverse without the human.

## Where things are

| Path | What |
|---|---|
| `src/pages/` | Screens: accounts, account-detail, dashboard |
| `src/lib/dataverse.ts` | `unwrap`, `formattedValue`, `odataString` |
| `src/lib/paging.ts`, `src/hooks/usePagedQuery.ts` | Paging, `fetchAllPages`, `fetchByIds` |
| `src/state/jobs.ts`, `src/components/job-toasts.tsx` | Background jobs and their toasts |
| `src/lib/deep-link.ts`, `src/lib/context.ts` | Shareable links, `getContext` with a timeout |
| `src/lib/version.ts` | Version and build date from `package.json` |
| `src/generated/` | Generated models and services: read, never edit |

## Style

- Match the surrounding code: shadcn/ui components, Tailwind classes, and each file's existing formatting.
- Comments explain *why*, briefly, in the style already used in `src/lib/`.
