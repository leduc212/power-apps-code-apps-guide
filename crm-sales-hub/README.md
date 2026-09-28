# CRM Sales Hub (demo app)

The Code App built through the guide's chapters: Accounts list with search, Account detail with related Opportunities and Contacts, create/delete Opportunities, and a pipeline dashboard. It runs against the standard Dynamics 365 `account`, `contact` and `opportunity` tables, so any environment with Dataverse and the Sales tables can host it.

**Stack:** React 19, TypeScript, Vite 7, TanStack Query, React Router, Tailwind + shadcn/ui, recharts.
**Power Apps:** `@microsoft/power-apps` 1.4, `@microsoft/power-apps-vite` 1.0.13, Power Apps CLI (`pa`) 1.0.

## Prerequisites

- Node.js LTS and Git
- A Power Platform environment with Dataverse and **code apps enabled** (Admin center > Environments > *env* > Settings > Product > Features > **Enable code apps**)
- The Power Apps CLI. Either install it globally:
  ```bash
  npm install --global @microsoft/power-apps-cli
  ```
  or run it without installing by replacing `pa` with `npx -p @microsoft/power-apps-cli pa` in the commands below.

You do **not** need the Power Platform CLI (`pac`) for this app.

## Setup

`power.config.json` is environment-specific and not committed. Create your own:

```bash
cd crm-sales-hub
npm install
pa auth login
pa app init --display-name "CRM Sales Hub" --environment-id <your-environment-id>
```

The generated Dataverse models and services in `src/generated/` are committed, but they were generated against the author's environment. Regenerate them against yours:

```bash
pa app add data-source --connector dataverse --table account
pa app add data-source --connector dataverse --table contact
pa app add data-source --connector dataverse --table opportunity
```

`--table` takes the table's **logical** name (singular), not its entity set name.

## Run locally

```bash
npm run dev
```

Open the **Local Play** URL printed in the terminal, not `localhost`, in the browser profile that is signed in to your tenant. Allow the browser's local network access prompt the first time.

## Deploy

```bash
npm run build
pa app push
```

Add `--solution-id <id>` to push into a solution (find the ID with `pa solution list`).

## After a schema change

```bash
pa app refresh data-source --name <data-source>   # omit --name to refresh all
```

Never hand-edit `src/generated/`; it is overwritten on refresh.

## Conventions used in the code

- **Every service call goes through `unwrap()`** (`src/lib/dataverse.ts`). Generated services resolve failed requests with `{ success: false }` instead of throwing; `unwrap` turns that into an error so TanStack Query can show it.
- **User input in an OData filter goes through `odataString()`**, which quotes the value and doubles any `'`.
- **Search is debounced** (`useDebouncedValue`), so typing does not send a request per keystroke.
- **Every query sets `select`.**
