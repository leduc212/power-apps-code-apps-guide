import { Button } from "@/components/ui/button"

type PagerProps = {
  pageIndex: number
  pageSize: number
  rowsOnPage: number
  totalCount?: number
  countCapped: boolean
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  noun: string
}

/** "26-50 of 1,204 accounts   [Previous] [Next]" */
export function Pager({ pageIndex, pageSize, rowsOnPage, totalCount, countCapped, hasPrev, hasNext, onPrev, onNext, noun }: PagerProps) {
  const first = pageIndex * pageSize + 1
  const last = pageIndex * pageSize + rowsOnPage
  const total =
    totalCount === undefined ? "" : ` of ${totalCount.toLocaleString()}${countCapped ? "+" : ""}`

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{rowsOnPage > 0 ? `${first}-${last}${total} ${noun}` : `No ${noun}`}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!hasPrev} onClick={onPrev}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={!hasNext} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  )
}
