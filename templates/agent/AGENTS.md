# <App name>: Rules for Coding Agents

<!--
  Template for a Code App project, especially a Canvas → Code migration.
  Copy to the repo root as AGENTS.md. For Claude Code, add a CLAUDE.md containing
  the single line: @AGENTS.md
  Keep it short and current. An agent follows what's written here literally,
  including anything that's out of date.
-->

## Start here: current status

<!-- Update this at the end of every working session. A new session reads it first. -->

- **Where we are:** <e.g. "All screens built. Remaining: live parity on screens 3-5, tests, polish.">
- **Read next:** `docs/MIGRATION_TRACKER.md`, then the spec for the screen you're working on in `docs/specs/`.

## Sources of truth

| Question | Answer lives in | Not in |
|---|---|---|
| What did the Canvas app do? | `<path to the pinned solution export>` (unzip; read `Src/*.pa.yaml` and `Workflows/*.json`) | Memory, or the generated files |
| Does a table or column exist? | The solution export's `customizations.xml` and flow write actions | `src/generated/` (it lists only what this app has onboarded) |
| What should this screen do? | `docs/specs/<Screen>.md`, as confirmed | The YAML alone |
| Is this difference intentional? | `docs/DIFFERENCES.md` | |
| SDK method names and shapes | `src/generated/services/*` and Microsoft's docs | Guessing |

## Hard rules

1. **Never edit `src/generated/` or `.power/`.** Schema change → the human regenerates; you review the diff.
2. **Don't invent SDK methods.** Check every call against the generated service.
3. **Every service call checks `success`** (an `unwrap()` helper). Failed calls resolve; they don't throw.
4. **Every Dataverse query sets `select`**, and lists page on the server (`maxPageSize` + `skipToken`, never `top` or `skip`).
5. **Escape user input in OData filters.**
6. **No direct HTTP.** External data goes through connectors or flows.
7. **No secrets in the code.** The built bundle is publicly downloadable.
8. **Log every behaviour change from Canvas** in `docs/DIFFERENCES.md`, and ask before fixing a Canvas bug.
9. <Project rules: theme file for colours, UI text conventions, component library, ...>

## Who does what

| The human | The agent |
|---|---|
| Sign-ins (`pa auth login`, `pa app init`) | Reading the export and writing specs |
| `pa app add ...` / `refresh ...` / `push` | Code, tests, docs |
| Dataverse and Power Automate changes | Plans for platform changes, written to `docs/specs/`, with the human's steps separated from the agent's |
| Live parity checks against Canvas | The parity checklist in each spec |
| Deploying | Saying clearly that a change is **not deployed** |

## The loop, per screen or slice

1. Extract a spec from the screen's YAML into `docs/specs/<Screen>.md` (template: `SCREEN_SPEC.md`). List open questions.
2. **Stop.** The human confirms the spec.
3. Implement. `npm run build` must pass.
4. **Stop.** The human runs the app and checks parity against live Canvas.
5. Fix, add unit tests for the rules, update `DIFFERENCES.md` and the tracker, commit.

## Before you say it's done

- Build and lint pass.
- New queries and mutations have visible error paths.
- You've listed what you could not verify, and what the human needs to check.
