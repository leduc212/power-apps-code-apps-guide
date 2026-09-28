# Chapter 5: Dashboard & Data Visualization

> **Blog post title:** Building CRM Dashboards That Canvas App Can't: Data Visualization in Power Apps Code Apps
>
> **Audience:** Following along from Chapter 4. You have an Account detail page with working CRUD. Now we build the screen that shows what Code Apps can do that Canvas genuinely cannot.
>
> **Updated September 2026** for SDK 1.4. The original February text is at the [`v1-feb-2026`](https://github.com/leduc212/power-apps-code-apps-guide/tree/v1-feb-2026) tag.

---

## Introduction

Canvas has built-in chart controls. You pick from a short list of chart types, hand them a table, and accept what you get: no per-bar colours, no custom tooltips, layout bound to the canvas grid.

A Code App is a standard React SPA, so any npm package works: recharts, Chart.js, Nivo, D3, the whole JavaScript charting ecosystem. This is where Code Apps stops being "Canvas but harder" and becomes genuinely more capable.

By the end of this chapter we have:

- Four KPI cards: pipeline value, win rate, average deal size, total opportunities
- A bar chart of open pipeline value by sales stage
- A bar chart of open opportunity count by rating (Hot / Warm / Cold)
- A loading skeleton, an error state, and a Refresh button

---

## What We Are Building

```
┌─────────────────────────────────────────────────────┐
│  Dashboard                              [Refresh]   │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │ Pipeline │ │ Win Rate │ │ Avg Deal │ │ Total  │  │
│  │  Value   │ │          │ │   Size   │ │  Opps  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘  │
│                                                     │
│  ┌───────────────────────┐ ┌─────────────────────┐  │
│  │ Pipeline by Stage     │ │ Opps by Rating      │  │
│  │  [bar chart]          │ │  [bar chart]        │  │
│  └───────────────────────┘ └─────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Step 1: recharts Is Already There

The `starter` template from Chapter 2 includes recharts:

```json
"recharts": "^2.15.4"
```

If you started from the minimal `vite` template instead, install it with `npm install recharts`.

---

## Step 2: One Query, All the Data

The whole dashboard is derived from one Opportunity query. We fetch open, won and lost opportunities together and compute every KPI and chart series in the component.

```tsx
const { data: opportunities = [], isLoading, isFetching, error, refetch } = useQuery({
  queryKey: ["dashboard-opportunities"],
  queryFn: async () => {
    const result = await OpportunitiesService.getAll({
      select: ["name", "statecode", "estimatedvalue", "opportunityratingcode", "salesstage"],
      top: 500,
    })
    return unwrap(result, "Load opportunities")
  },
})
```

### Why One Query Instead of Three

Separate queries for open, won and lost would be three round trips for rows from the same table. One query is simpler and faster at this size.

### The `top: 500` Limit (and Why It's a Shortcut)

`top: 500` means **at most 500 rows**. If you have more, the rest are silently left out and every KPI on the page is wrong without any sign of it. That's acceptable for a demo on a trial environment. It isn't acceptable in production.

The fixes, all covered in Chapter 7:

1. **Fetch every page.** Walk the `skipToken` that comes back with each page until there isn't one, with a safety cap. Fine for a few thousand rows.
2. **Ask for the total.** SDK 1.4 added `count: true`, which returns the server-side total (Dataverse caps it at 5,000). At minimum, compare it to the rows you have and warn when the dashboard is incomplete.
3. **Aggregate on the server.** The generated services don't expose OData `$apply`, so sums and group-bys over large tables need another route: a Dataverse custom API added with `pa app add dataverse-api`, or a Power Automate flow. Past a few thousand rows, this is the right answer.

> **Correction from February:** I promised that Chapter 6 would cover `$apply`. It didn't, and the generated services still can't do it. The options above are what actually works.

### The Error State

Because the query uses `unwrap`, a failure reaches `error` and the page shows it, with a way to retry:

```tsx
if (error) {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-destructive">Failed to load opportunities: {error.message}</p>
      <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
        Try again
      </Button>
    </div>
  )
}
```

A dashboard that fails silently shows zeros, and zeros look like real numbers. That's worse than an error.

---

## Step 3: Deriving KPIs in the Component

```tsx
const open = opportunities.filter(o => Number(o.statecode) === 0)
const won  = opportunities.filter(o => Number(o.statecode) === 1)
const lost = opportunities.filter(o => Number(o.statecode) === 2)

const totalPipeline = open.reduce(
  (sum, o) => sum + (o.estimatedvalue ? Number(o.estimatedvalue) : 0),
  0
)
const winRate =
  won.length + lost.length > 0
    ? Math.round((won.length / (won.length + lost.length)) * 100)
    : 0
const avgDeal = open.length > 0 ? totalPipeline / open.length : 0
```

The `Number()` coercion on `statecode` and `estimatedvalue` is the same habit from Chapters 3 and 4: correct whether the value arrives as a string or a number.

---

## Step 4: Preparing Chart Data

Charts in recharts take an array of plain objects. Shape the data before rendering:

```tsx
// Pipeline value by sales stage (open opportunities only)
const byStage = [0, 1, 2, 3].map(stage => ({
  stage: STAGE_LABELS[stage],
  value: open
    .filter(o => Number(o.salesstage) === stage)
    .reduce((s, o) => s + (o.estimatedvalue ? Number(o.estimatedvalue) : 0), 0),
}))

// Opportunity count by rating (open opportunities only)
const byRating = [1, 2, 3].map(rating => ({
  rating: RATING_LABELS[rating],
  count: open.filter(o => Number(o.opportunityratingcode) === rating).length,
  color: RATING_COLORS[rating],
}))
```

With the label maps:

```tsx
const STAGE_LABELS: Record<number, string> = { 0: "Qualify", 1: "Develop", 2: "Propose", 3: "Close" }
const RATING_LABELS: Record<number, string> = { 1: "Hot", 2: "Warm", 3: "Cold" }
const RATING_COLORS: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#3b82f6" }
```

Chapter 3 recommended reading labels from the `FormattedValue` annotation. Chart axes are the exception: a chart needs a fixed set of categories in a fixed order, including categories with no rows, and annotations only exist on rows you received. A local map is the right tool here. If your organization customizes these choices, keep the map next to the chart and update it when the choice column changes.

---

## Step 5: Building the Charts

### `ResponsiveContainer` Is Required

recharts charts have a fixed pixel size by default. Wrap them in `ResponsiveContainer` so they fill their parent and resize with the window:

```tsx
<ResponsiveContainer width="100%" height={220}>
  <BarChart data={byStage} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
    ...
  </BarChart>
</ResponsiveContainer>
```

### Pipeline by Stage

```tsx
<BarChart data={byStage} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
  <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
  <YAxis tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11 }} width={60} />
  <Tooltip formatter={v => fmt(v as number)} />
  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
</BarChart>
```

- `tickFormatter` on `YAxis` shows `$1.2M` instead of `1200000`
- `formatter` on `Tooltip` uses the same format on hover
- `radius={[4, 4, 0, 0]}` rounds the top corners of the bars

### Chart Colours

The demo passes explicit hex colours to `fill`. Theme tokens from Tailwind or shadcn (`hsl(var(--primary))`, `oklch(...)`) are easy to get wrong in SVG attributes, and a wrong colour fails silently: the bar just renders black. Keep chart colours in one constants file and import them, rather than scattering hex strings across components.

### Per-Bar Colours with `Cell`

To colour each bar differently (red for Hot, orange for Warm, blue for Cold), put a `Cell` per bar inside the `Bar`:

```tsx
import { Cell } from "recharts"

<Bar dataKey="count" radius={[4, 4, 0, 0]}>
  {byRating.map((entry, i) => (
    <Cell key={i} fill={entry.color} />
  ))}
</Bar>
```

Canvas's built-in charts have no per-bar colour control at all.

---

## Step 6: Loading Skeleton

Show a skeleton with the same shape as the final layout, so nothing jumps when the data arrives:

```tsx
if (isLoading) {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
```

---

## Step 7: Wire Up the Route and Nav

```tsx
// router.tsx
{ path: "dashboard", element: <DashboardPage /> },
```

```tsx
// _layout.tsx
<NavLink to="/dashboard"
  className={({ isActive }) =>
    `text-sm text-muted-foreground hover:text-foreground ${isActive ? "text-foreground font-medium" : ""}`
  }
>
  Dashboard
</NavLink>
```

---

## KPI Formatting Utility

```tsx
function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}
```

Used by the KPI cards, the axis and the tooltip, so every number on the page is formatted the same way. (It assumes a single currency. Multi-currency organizations should use the `_base` columns, such as `estimatedvalue_base`, which Dataverse converts to the base currency.)

---

## Key Takeaways

- recharts, and any npm charting library, works in Code Apps
- `ResponsiveContainer` makes charts fill their parent; `Cell` gives per-bar colours
- One broad query plus client-side derivation is a fine default **at small scale**; `top: 500` silently truncates, so fetch all pages, check the count, or aggregate on the server (Chapter 7)
- The generated services don't expose `$apply`; server-side aggregation needs a custom API or a flow
- A dashboard needs an error state more than any other page, because zeros look like real numbers
- Use explicit colours for chart fills; use fixed label maps for chart categories

---

## What's Next

Chapter 6 covers user context and moving the app between environments: `getContext()` to personalise the app, then solutions, connection references and pipelines.

---

*Previous: Chapter 4 - Full CRUD for CRM Records*
*Next: Chapter 6 - Context, ALM & Production Readiness*
