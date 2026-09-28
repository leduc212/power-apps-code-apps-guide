import { useEffect, useState } from "react"

/**
 * Returns `value` once it has stopped changing for `delayMs`.
 * Use it for query keys driven by typing, so each keystroke does not fire a
 * Dataverse request. (`useDeferredValue` defers rendering, not requests.)
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
