# Chapter 5: Dashboard & Data Visualization

> **Blog post title:** Building CRM Dashboards That Canvas App Can't: Data Visualization in Power Apps Code Apps
>
> **Audience:** Following along from Chapter 4. You have an Account detail page with working CRUD. Now we build the screen that shows what Code Apps can do that Canvas App genuinely cannot.

---

## Introduction

Canvas App has some built-in chart controls. They are limited. You pick from a small list of chart types, hand them a data table, and accept what you get. You cannot control colours per bar, you cannot write a custom tooltip, and the layout is constrained to the canvas grid.

Code Apps are a standard React SPA. Any npm package works. That means recharts, Victory, Chart.js, Nivo — the full JavaScript charting ecosystem. The Dashboard chapter is where Code Apps stops being "Canvas App but harder" and starts being genuinely more powerful.

By the end of this chapter we have:

- Four KPI cards: pipeline value, win rate, average deal size, total opportunities
- A bar chart of open pipeline value by sales stage
- A bar chart of open opportunity count by rating (Hot / Warm / Cold)
- A loading skeleton that covers the entire dashboard while data fetches

---

## What We Are Building

```
┌─────────────────────────────────────────────────────┐
│  Dashboard                                          │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Pipeline │ │ Win Rate │ │ Avg Deal │ │ Total  │ │
│  │  Value   │ │          │ │   Size   │ │  Opps  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                     │
│  ┌───────────────────────┐ ┌─────────────────────┐  │
│  │ Pipeline by Stage     │ │ Opps by Rating      │  │
│  │  [bar chart]          │ │  [bar chart]        │  │
│  └───────────────────────┘ └─────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Step 1: recharts Is Already There

The starter template from `npx degit github:microsoft/PowerAppsCodeApps/templates/vite` already includes recharts in `package.json`. No install needed — the package is part of the starter:

```json
"recharts": "^2.15.4"
```

If you scaffolded manually without the template, install it:

```bash
npm install recharts
```

---

## Step 2: One Query, All the Data

The dashboard is derived from a single Opportunity query. We fetch all opportunities (open, won, and lost) in one call and compute every KPI and chart series from that dataset in the component.

```tsx
const { data: opportunities = [], isLoading } = useQuery({
  queryKey: ["dashboard-opportunities"],
  queryFn: async () => {
    const result = await OpportunitiesService.getAll({
      select: ["name", "statecode", "estimatedvalue", "opportunityratingcode", "salesstage"],
      top: 500,
    })
    return result.data ?? []
  },
})
```

### Why One Query Instead of Three

You could fire separate queries for open, won, and lost opportunities — one per KPI group. That is three round-trips to Dataverse for data that arrives from the same table. A single query with `top: 500` is simpler and faster.

### The `top` Limit

`top: 500` is a soft ceiling. Dataverse will return at most 500 records per page. For a portfolio or department-sized dataset this is fine. If you are building for an enterprise with thousands of opportunities, you have two options:

1. **Paginate and aggregate client-side** — use the `skipToken` field that comes back in the result to fetch subsequent pages, then merge everything before deriving the KPIs. This works but makes the fetch logic significantly more complex.
2. **Use server-side aggregation** — Dataverse supports OData `$apply` for grouping and summing server-side. The generated SDK does not expose `$apply` directly, but you can hit the Web API directly with `fetch` for aggregate-only queries. Chapter 6 touches on this.

For now, `top: 500` keeps the code simple and works correctly for any realistic demo or small-business dataset.

---

## Step 3: Deriving KPIs in the Component

All four KPI values come from filtering and reducing the fetched array. No server-side query changes needed:

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

**The `Number(o.statecode)` pattern again** — as covered in Chapter 3, the generated model types `statecode` as a union of string literals, but the runtime value is a number. We already know to cast with `Number()`.

**The `Number(o.estimatedvalue)` pattern again** — `estimatedvalue` is typed as `string` but arrives and needs to be treated as a number, as covered in Chapter 4. Consistent rule: always `Number()` for any currency, decimal, or integer field.

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

Where the label maps are:

```tsx
const STAGE_LABELS: Record<number, string> = {
  0: "Qualify",
  1: "Develop",
  2: "Propose",
  3: "Close",
}
const RATING_LABELS: Record<number, string> = { 1: "Hot", 2: "Warm", 3: "Cold" }
const RATING_COLORS: Record<number, string> = {
  1: "#ef4444",  // red
  2: "#f97316",  // orange
  3: "#3b82f6",  // blue
}
```

---

## Step 5: Building the Charts

### `ResponsiveContainer` Is Required

recharts components like `BarChart` have a fixed pixel size by default. To make them fill their parent container (which is what you almost always want in a responsive layout), wrap them in `ResponsiveContainer`:

```tsx
<ResponsiveContainer width="100%" height={220}>
  <BarChart data={byStage} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
    ...
  </BarChart>
</ResponsiveContainer>
```

Without `ResponsiveContainer`, the chart will not resize when the window width changes.

### Pipeline by Stage Bar Chart

```tsx
<BarChart data={byStage} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
  <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
  <YAxis tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11 }} width={60} />
  <Tooltip formatter={v => fmt(v as number)} />
  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
</BarChart>
```

- `tickFormatter` on `YAxis` — formats axis labels as `$1.2M` instead of `1200000`
- `formatter` on `Tooltip` — same formatting in the hover tooltip
- `radius={[4, 4, 0, 0]}` — rounded top corners on the bars

### Why No CSS Variables for Colors

In Canvas App you would reference a theme colour token. In recharts, `fill` is an SVG attribute — not a CSS property. CSS custom properties (variables like `var(--primary)`) are resolved by the browser's CSS engine, which does not apply to inline SVG attributes. Using `fill="hsl(var(--primary))"` or `fill="oklch(var(--primary))"` will not work here.

The practical solution is to use hardcoded hex colours that match your design system. For a production app you would define a theme constants file and import from there, rather than scattering hex strings across components.

### Rating Bar Chart with Per-Bar Colours

To colour each bar differently (red for Hot, orange for Warm, blue for Cold), use recharts' `Cell` component inside the `Bar`:

```tsx
import { Cell } from "recharts"

<Bar dataKey="count" radius={[4, 4, 0, 0]}>
  {byRating.map((entry, i) => (
    <Cell key={i} fill={entry.color} />
  ))}
</Bar>
```

`Cell` overrides the fill for a specific bar by index. This is a pattern you cannot do at all in Canvas App's built-in charts — there is no per-bar colour control.

---

## Step 6: Loading Skeleton

The dashboard fetches data asynchronously. While it loads, show a skeleton layout that matches the shape of the final UI. This avoids a jarring layout shift when data arrives:

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

Add the import and route in `router.tsx`:

```tsx
import DashboardPage from "@/pages/dashboard"

// in the routes array:
{ path: "dashboard", element: <DashboardPage /> },
```

Add the nav link in `_layout.tsx`:

```tsx
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

A small helper formats large numbers cleanly — `$1.2M` instead of `$1234567.89`:

```tsx
function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}
```

This gets used in both the KPI card values and the chart axis / tooltip formatters, keeping output consistent everywhere.

---

## Key Takeaways

- recharts (and any npm charting library) works in Code Apps — this is categorically impossible in Canvas App
- `ResponsiveContainer` is required to make recharts charts fill their parent container
- recharts `fill` is an SVG attribute — CSS custom properties like `var(--primary)` do not resolve here; use hardcoded hex colours or a theme constants file
- `Cell` inside a `Bar` gives you per-bar colour control — something Canvas App charts cannot do
- One broad query + client-side derivation is the right default for dashboard data at reasonable scale; switch to server-side `$apply` aggregation only when needed
- The `Number()` cast on `statecode` and `estimatedvalue` is the same pattern from Chapters 3 and 4 — it applies consistently across every numeric field in the generated types
- Skeleton loading states that mirror the final layout prevent layout shift and give the app a production-quality feel

---

## What's Next

Chapter 6 covers context and ALM. We use `getContext()` to personalise the dashboard (filter to "my opportunities"), then push the app to a Power Platform solution and set up a Dev→Prod pipeline.

---

*Previous: Chapter 4 - Full CRUD for CRM Records*
*Next: Chapter 6 - Context, ALM & Production Readiness*
