import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { getLaunchRoute } from "@/lib/deep-link"

/**
 * On launch, opens the route a shared link pointed at. Renders nothing.
 * Must be inside the router.
 */
export function DeepLinkBootstrap() {
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // once per launch (and StrictMode runs effects twice in dev)
    ran.current = true
    void getLaunchRoute().then((route) => {
      if (route) navigate(route, { replace: true })
    })
  }, [navigate])

  return null
}
