import { useQuery } from "@tanstack/react-query"
import { getContext } from "@microsoft/power-apps/app"

/** getContext() waits on the Power Apps host; outside the player it never resolves. */
const CONTEXT_TIMEOUT_MS = 3000

export function useAppContext() {
  return useQuery({
    queryKey: ["app-context"],
    queryFn: () =>
      Promise.race([
        getContext(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("getContext timed out")), CONTEXT_TIMEOUT_MS)
        ),
      ]),
    staleTime: Infinity, // context is stable for the lifetime of a session
  })
}
