import { useQuery } from "@tanstack/react-query"
import { OpportunitiesService } from "@/generated/services/OpportunitiesService"
import { unwrap } from "@/lib/dataverse"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

const STAGE_LABELS: Record<number, string> = {
  0: "Qualify",
  1: "Develop",
  2: "Propose",
  3: "Close",
}

const RATING_LABELS: Record<number, string> = { 1: "Hot", 2: "Warm", 3: "Cold" }
const RATING_COLORS: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#3b82f6" }

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border rounded-lg p-4 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

export default function DashboardPage() {
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

  // Pipeline value grouped by sales stage (open only)
  const byStage = [0, 1, 2, 3].map(stage => ({
    stage: STAGE_LABELS[stage],
    value: open
      .filter(o => Number(o.salesstage) === stage)
      .reduce((s, o) => s + (o.estimatedvalue ? Number(o.estimatedvalue) : 0), 0),
  }))

  // Opportunity count grouped by rating (open only)
  const byRating = [1, 2, 3].map(rating => ({
    rating: RATING_LABELS[rating],
    count: open.filter(o => Number(o.opportunityratingcode) === rating).length,
    color: RATING_COLORS[rating],
  }))

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Pipeline Value"
          value={fmt(totalPipeline)}
          sub={`${open.length} open opportunities`}
        />
        <KpiCard
          label="Win Rate"
          value={`${winRate}%`}
          sub={`${won.length} won · ${lost.length} lost`}
        />
        <KpiCard
          label="Avg Deal Size"
          value={open.length ? fmt(avgDeal) : "—"}
          sub="open opportunities"
        />
        <KpiCard
          label="Total Opportunities"
          value={String(opportunities.length)}
          sub={`${open.length} open · ${won.length} won`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pipeline value by sales stage */}
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-medium text-sm">Pipeline by Stage</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byStage} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={v => fmt(v as number)} />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Count by rating */}
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-medium text-sm">Open Opportunities by Rating</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byRating} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <XAxis dataKey="rating" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byRating.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
