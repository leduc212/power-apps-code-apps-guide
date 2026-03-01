import { useQuery } from "@tanstack/react-query"
import { getContext } from "@microsoft/power-apps/app"

export function useAppContext() {
  return useQuery({
    queryKey: ["app-context"],
    queryFn: () => getContext(),
    staleTime: Infinity, // context is stable for the lifetime of a session
  })
}
