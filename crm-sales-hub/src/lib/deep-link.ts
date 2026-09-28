import { getContextWithTimeout } from "@/lib/context"

/**
 * Deep links into the app.
 *
 * Inside the Power Apps player, the app runs in an iframe served from an
 * internal host, so `window.location.href` is not a link anyone else can open.
 * The shareable URL is the player URL. The player passes custom query
 * parameters on it through to `getContext().app.queryParams` (but drops any
 * #hash), so the in-app route travels as one parameter and is replayed on launch.
 */
const ROUTE_PARAM = "route"

/** A player URL that opens the app at `route`, e.g. "/accounts/<id>". */
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

/**
 * The route the app was launched with, if any. Only accepts an in-app path
 * (one leading slash), so a crafted link can't send the user to another site.
 */
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

/**
 * Copies text to the clipboard. The async Clipboard API can be blocked inside
 * the player's iframe, so this falls back to the older execCommand path.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Blocked by the iframe's permissions policy: try the fallback.
  }
  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.opacity = "0"
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    area.remove()
  }
}
