import { useQuery } from "@tanstack/react-query"
import { getContextWithTimeout } from "@/lib/context"

export function useAppContext() {
  return useQuery({
    queryKey: ["app-context"],
    queryFn: () => getContextWithTimeout(),
    staleTime: Infinity, // context is stable for the lifetime of a session
  })
}
