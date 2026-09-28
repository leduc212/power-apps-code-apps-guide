import { getContext, type IContext } from "@microsoft/power-apps/app"

/** getContext() waits on the Power Apps host; outside the player it never resolves. */
const CONTEXT_TIMEOUT_MS = 3000

/** getContext(), but rejects instead of hanging when there's no host. */
export function getContextWithTimeout(ms = CONTEXT_TIMEOUT_MS): Promise<IContext> {
  return Promise.race([
    getContext(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("getContext timed out")), ms)),
  ])
}
