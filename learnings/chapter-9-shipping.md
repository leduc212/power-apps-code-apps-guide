# Chapter 9: Shipping for Real

> **Blog post title:** Releasing and Supporting a Power Apps Code App: Versions, Stale Tabs, Deep Links and Testers
>
> **Audience:** You've read Chapters 7 and 8. The app is built. Now real people will use it, report problems with it, and keep it open in a tab for a week.
>
> **Part 2** is based on a production Code App we implemented to replace a large Canvas App. The patterns are real; the code is rewritten against this repo's demo tables.

---

## Introduction

`pa app push` publishes the app. Everything after that is a different job, and in our production app it produced a surprising share of the support questions:

- "It's broken." *Which version are you on?* Nobody knew.
- A fix was deployed, and a user kept hitting the bug for two days. Their tab was still running the old build.
- Someone pasted a link to a record in chat. It opened a blank page for everyone else.
- A tester couldn't do anything, and the app was fine. They were missing a security role.

This chapter covers what fixed each one: a version number users can read, a way to get people off old builds, deep links that work, an environment banner, a release checklist, and a tester onboarding list.

In the demo: the version is in the header, and account pages have a **Copy link** button that produces a link other people can open.

---

## 1. A Version Number Users Can Read

When someone reports a problem, the first question is which build they're running. Put the answer on screen.

`package.json` already has a `version`. Make it the single source of truth and inject it at build time:

```typescript
// vite.config.ts
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8")) as { version: string }

export default defineConfig({
  // ...
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
})
```

```typescript
// src/lib/version.ts
declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string

export const APP_VERSION: string = __APP_VERSION__
export const BUILD_DATE: string = __BUILD_DATE__
```

The demo shows `v1.0.0` in the header, with the build time in a tooltip. The build date matters more than it looks: two deploys of the same version number (a hotfix you forgot to bump) are told apart by it.

A release is then:

```bash
npm version patch --no-git-tag-version   # 1.0.0 -> 1.0.1
npm run build
pa app push --solution-id <solution-id>
```

`--no-git-tag-version` stops npm creating its own git tag; tag releases yourself, in whatever scheme your team uses. (We tagged by environment and date, like `UAT_RELEASE_2026-08-21`, because "what's in UAT right now" was the question people asked.)

Two things not to do:

- **Don't `import pkg from "../package.json"` in app code.** A default import puts the whole file, dependency list included, into the bundle, which anyone can download (see the security gotcha in the README). `define` injects just the string.
- **Don't reuse the `"version"` in `power.config.json`.** That's the config file's format version, not your app's.

---

## 2. Getting People Off Old Builds

Users leave the app open in a tab for days. When you deploy, that tab keeps running the old bundle, including the bug you just fixed, and whatever the old bundle sends to flows and tables that may have just changed.

Two things we observed in production:

- The Power Apps player **does** show its own "a new version is available" notice. Users dismiss it, or never see it.
- A plain reload doesn't always help: the browser can serve the old cached bundle again. A hard refresh (Ctrl+F5, or Ctrl+Shift+R) reliably loads the new one.

For most releases that's fine. For a release that *must* reach everyone (a changed flow contract, a data fix), we added a **required version**: an environment variable holding the minimum version the environment accepts. Every open tab checks it periodically and when it regains focus. If the running version is older, the app blocks and asks for a refresh.

This isn't in the demo, because it reads environment variables, and those need their tables added as data sources from a live environment:

```bash
pa app add data-source --connector dataverse --table environmentvariabledefinition
pa app add data-source --connector dataverse --table environmentvariablevalue
```

The code, following Chapter 6's pattern for reading an environment variable:

```typescript
// Reads an environment variable's current value, falling back to its default.
async function getEnvironmentVariable(schemaName: string): Promise<string | undefined> {
  const definitions = unwrap(
    await EnvironmentvariabledefinitionsService.getAll({
      select: ["environmentvariabledefinitionid", "defaultvalue"],
      filter: `schemaname eq ${odataString(schemaName)}`,
      top: 1,
    }),
    "Load environment variable",
  )
  const definition = definitions[0]
  if (!definition) return undefined

  const values = unwrap(
    await EnvironmentvariablevaluesService.getAll({
      select: ["value"],
      filter: `_environmentvariabledefinitionid_value eq ${definition.environmentvariabledefinitionid}`,
      top: 1,
    }),
    "Load environment variable value",
  )
  return (values[0]?.value ?? definition.defaultvalue)?.trim() || undefined
}

export function useRequiredVersion() {
  return useQuery({
    queryKey: ["required-app-version"],
    queryFn: () => getEnvironmentVariable("new_RequiredAppVersion"),
    staleTime: 0,
    refetchInterval: 5 * 60 * 1000,   // an idle tab still finds out
    refetchOnWindowFocus: true,       // and a tab the user comes back to finds out immediately
  })
}
```

```tsx
export function VersionGate() {
  const { data: required } = useRequiredVersion()
  const hasUnsavedWork = useHasUnsavedWork()   // see below

  if (!required || !isOlder(APP_VERSION, required)) return null

  const message = `Version ${required} is available (you have ${APP_VERSION}). Refresh the page with Ctrl+F5 to update.`

  // Never pull someone off work they haven't saved: warn now, block once they're done.
  if (hasUnsavedWork) return <Banner>{message} Save your changes first.</Banner>
  return <BlockingDialog title="Update required">{message}</BlockingDialog>
}
```

`isOlder` compares versions part by part (`1.10.0` is newer than `1.9.0`, which a string comparison gets wrong):

```typescript
function isOlder(current: string, required: string): boolean {
  const a = current.split(".").map(Number)
  const b = required.split(".").map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0)
  }
  return false
}
```

Use "older than", not "not equal to". With a not-equal check, every release that *doesn't* bump the variable blocks the **new** build, because it's now ahead of the required version, and that includes all the releases you deliberately didn't force.

Lessons from running it:

- **Set the variable's default to the current version** when you introduce it, or the first deploy blocks everyone.
- **Bump it only for releases that need it.** Most releases can wait for the player's notice. Forcing a refresh for every release trains people to resent the dialog.
- **No "Refresh" button.** We had one, and it called `location.reload()`. That's the plain reload that can re-serve the old bundle: the button did nothing visible and users clicked it five times. Tell people the key combination instead.
- **Protect unsaved work.** Our app kept a global count of "edits in progress" (incremented when an edit form opened, decremented when it saved or closed). The gate downgrades to a dismissible banner while it's above zero, and escalates to the dialog automatically when it drops.

---

## 3. An Environment Banner

Testers use Dev and UAT. Everyone else uses Production. It's easy to lose track of which one is open, and "I tested it in Production by mistake" is a bad sentence to hear.

We showed a band under the header on non-production environments: *"This is the UAT environment. Data here is for testing."* The environment's name came from another environment variable (`getEnvironmentVariable("new_EnvironmentName")`), so the same build shows the right text everywhere, and **Production has no value, so it shows nothing.**

Two details that made it better:

- **Reserve the band's height while the value loads**, with a skeleton line. Otherwise the whole page jumps down a moment after it appears.
- **Put the specific risk in the text.** "This is DEV" is ignored. "This is DEV: orders submitted here don't reach the real system" is read.

---

## 4. Deep Links That Work

"Look at this account" plus a link is how people work. In a Code App, the obvious link is broken:

- **`window.location.href` is not shareable.** Inside the player, your app runs in an iframe served from an internal host. Opening that URL directly loads your HTML with no Power Platform context, so nothing loads.
- **The player drops the `#hash`.** If you use a hash router, the route doesn't survive the trip.
- **The player does forward custom query parameters**, and your app reads them from `getContext().app.queryParams`.

So a deep link is the **player URL** with the in-app route in a query parameter:

```
https://apps.powerapps.com/play/e/<environment-id>/app/<app-id>?tenantId=<tenant-id>&route=/accounts/<account-id>
```

The demo builds it from the context:

```typescript
// src/lib/deep-link.ts
const ROUTE_PARAM = "route"

export async function buildShareUrl(route: string): Promise<string> {
  try {
    const ctx = await getContextWithTimeout()
    const { appId, environmentId } = ctx.app
    if (appId && environmentId) {
      const params = new URLSearchParams()
      if (ctx.user.tenantId) params.set("tenantId", ctx.user.tenantId)
      params.set(ROUTE_PARAM, route)
      return `https://apps.powerapps.com/play/e/${environmentId}/app/${appId}?${params}`
    }
  } catch {
    // No host (e.g. plain localhost): fall through.
  }
  return window.location.href
}
```

And replays it once on launch:

```typescript
export async function getLaunchRoute(): Promise<string | undefined> {
  try {
    const ctx = await getContextWithTimeout()
    const route = ctx.app.queryParams?.[ROUTE_PARAM]
    if (route && route.startsWith("/") && !route.startsWith("//")) return route
  } catch {
    // No host or no parameter.
  }
  return undefined
}
```

```tsx
// src/components/deep-link-bootstrap.tsx, rendered once in the layout
export function DeepLinkBootstrap() {
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    void getLaunchRoute().then((route) => {
      if (route) navigate(route, { replace: true })
    })
  }, [navigate])

  return null
}
```

Details worth copying:

- **Validate the route.** It comes from a URL anyone can craft. Accept only an in-app path: one leading `/`, not `//`, which a browser treats as another site.
- **`replace: true`**, so Back doesn't return to the empty start page.
- **Keep the tenant ID.** It sends people who belong to several tenants, guest users especially, to the right one.

The **Copy link** button on the demo's account page calls `buildShareUrl` with the current route. Copying is its own small problem: **the async Clipboard API can be blocked inside the player's iframe**, so `copyText` falls back to the older `execCommand("copy")` path when it fails.

The player also takes `hideNavBar=true` to hide its header for that link (Chapter 2). Useful for links embedded in another page.

---

## 5. A Release Checklist

What we ran for each release, generalised:

1. **Check who you are.** `pa auth status`. The CLI pushes to whatever the active account points at.
2. **Bump the version.** `npm version patch --no-git-tag-version`.
3. **Build from a clean tree.** `npm run build`, with no uncommitted changes, so the build matches a commit.
4. **Deploy flows and schema first**, if their contract changed (Chapter 8: optional inputs first).
5. **Push.** `pa app push --solution-id <id>`, or through your pipeline (Chapter 6).
6. **Smoke-test from the play URL**, not localhost. Open a record through a deep link. Check the header shows the new version.
7. **Tag the commit** with the environment and date.
8. **Bump the required version** only if this release must reach every open tab.
9. **Write two lines of release notes** for the people who'll get the questions.

---

## 6. Onboarding Testers

Sharing the app lets someone open it. Being able to use it takes more. The list we sent with every new tester:

| Step | Why |
|---|---|
| Share the app: maker portal, or `pa app share --principal <email>` | Otherwise they can't open it |
| Assign a Dataverse **security role** covering the app's tables, and one that can invoke flows (Microsoft suggests **App Opener** or equivalent) | Otherwise the app opens, then every query fails |
| Make sure the **flows are on**, and their connections belong to an account that won't leave | Otherwise flow buttons fail for everyone at once, one day |
| Tell them to **accept the connection prompts** on first launch | Directly-called connectors run on the user's own connection |
| Add them to the **app's own user table**, if it has one | Our app kept its own list of users and permissions; a missing row meant an empty app |
| Send a **deep link**, not just the app name | They land exactly where you want them to look |

And a troubleshooting table for the first week:

| Symptom | Usual cause |
|---|---|
| App opens, every list says it failed to load | No security role on the tables |
| Works for the maker, not for testers | Permissions, not code: the table above, in order |
| "I still see the old behaviour" | Stale tab: hard refresh (Ctrl+F5) |
| A shared link opens a blank page | It's a `window.location.href` link, not a player link |
| Changes to `power.config.json` don't take effect locally | The dev server reads it at startup: restart `npm run dev` |
| The wrong environment got the release | Check `pa auth status` before every push |

---

## Key Takeaways

- Inject `package.json`'s version and the build time with Vite's `define`, and show them. "Which version?" should have an answer
- Users keep old builds open for days; a plain reload may serve the cached bundle; a hard refresh gets the new one
- For releases that must reach everyone, a **required version** environment variable, checked on an interval and on focus, blocks old tabs, but only after unsaved work is saved
- Show an **environment banner** on non-production environments, driven by an environment variable, and nothing in Production
- **Deep links are player URLs** with the route in a query parameter, read back from `getContext().app.queryParams`. `location.href` isn't shareable and the player drops the hash
- Validate launch routes, and fall back from the Clipboard API inside the iframe
- Release with a checklist, and onboard testers with one. Most first-week issues are roles, flows and connections

---

## What's Next

Chapter 10 steps back to the migration itself: how to take a large Canvas App apart and rebuild it in code, from measuring what you have, to tracking where the new app deliberately behaves differently.

---

*Previous: Chapter 8 - Flows and Connectors*
*Next: Chapter 10 - Canvas → Code Migration*
