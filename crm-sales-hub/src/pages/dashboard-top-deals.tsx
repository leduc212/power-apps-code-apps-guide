import { useQuery } from "@tanstack/react-query"
import { AccountsService } from "@/generated/services/AccountsService"
import type { Opportunities } from "@/generated/models/OpportunitiesModel"
import { formattedValue } from "@/lib/dataverse"
import { fetchByIds } from "@/lib/paging"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const TOP_N = 5

/**
 * The biggest open deals, with their account's name and city.
 *
 * Two ways to get related data without `$expand`:
 *  - The account NAME comes free: select `_parentaccountid_value` and read its
 *    formatted-value annotation.
 *  - The account CITY needs the account row itself, so it's one batched query
 *    for all five accounts (fetchByIds), not five queries.
 */
export function TopDeals({ open }: { open: Opportunities[] }) {
  const top = [...open]
    .sort((a, b) => Number(b.estimatedvalue ?? 0) - Number(a.estimatedvalue ?? 0))
    .slice(0, TOP_N)
  const accountIds = top.map((o) => o._parentaccountid_value)

  const { data: cityById, error } = useQuery({
    queryKey: ["top-deal-accounts", accountIds],
    enabled: accountIds.some(Boolean),
    queryFn: async () => {
      const accounts = await fetchByIds(
        AccountsService.getAll,
        "accountid",
        accountIds,
        ["accountid", "address1_city"],
        "Load accounts",
      )
      return new Map(accounts.map((a) => [a.accountid, a.address1_city]))
    },
  })

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h2 className="font-medium text-sm">Top Open Deals</h2>
      {error && <p className="text-sm text-destructive">Failed to load account details: {error.message}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Opportunity</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>City</TableHead>
            <TableHead className="text-right">Est. Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {top.map((o) => (
            <TableRow key={o.opportunityid}>
              <TableCell className="font-medium">{o.name}</TableCell>
              <TableCell>{formattedValue(o, "_parentaccountid_value") ?? "-"}</TableCell>
              <TableCell>{(o._parentaccountid_value && cityById?.get(o._parentaccountid_value)) || "-"}</TableCell>
              <TableCell className="text-right">
                {o.estimatedvalue ? `$${Number(o.estimatedvalue).toLocaleString()}` : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
