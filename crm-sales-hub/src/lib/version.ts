// Replaced at build time by the `define` block in vite.config.ts.
declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string

/** From package.json. Bump with `npm version patch --no-git-tag-version`. */
export const APP_VERSION: string = __APP_VERSION__

/** When the running bundle was built (ISO). Two deploys of one version differ here. */
export const BUILD_DATE: string = __BUILD_DATE__

/** "Version 1.0.3, built 28/09/2026" for a tooltip or an About box. */
export function versionDescription(): string {
  const built = new Date(BUILD_DATE)
  return Number.isNaN(built.getTime())
    ? `Version ${APP_VERSION}`
    : `Version ${APP_VERSION}, built ${built.toLocaleString()}`
}
