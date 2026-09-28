import { useState } from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { buildShareUrl, copyText } from "@/lib/deep-link"

/** Copies a link that opens the app on the current page, for pasting to a colleague. */
export function CopyLinkButton() {
  const { pathname } = useLocation()
  const [copying, setCopying] = useState(false)

  async function onCopy() {
    setCopying(true)
    try {
      const ok = await copyText(await buildShareUrl(pathname))
      if (ok) toast.success("Link copied")
      else toast.error("Could not copy the link")
    } finally {
      setCopying(false)
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={copying} onClick={() => void onCopy()}>
      Copy link
    </Button>
  )
}
