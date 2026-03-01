import { useState, useDeferredValue } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AccountsService } from "@/generated/services/AccountsService"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function AccountsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)

  const { data: accounts = [], isLoading, isError } = useQuery({
    queryKey: ["accounts", deferredSearch],
    queryFn: async () => {
      const result = await AccountsService.getAll({
        select: ["name", "accountnumber", "address1_city", "telephone1", "statecode"],
        filter: deferredSearch ? `contains(name, '${deferredSearch}')` : undefined,
        orderBy: ["name asc"],
        top: 50,
      })
      return result.data ?? []
    },
  })

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Accounts</h1>

      <Input
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isError && (
        <p className="text-sm text-destructive">Failed to load accounts. Check your Dataverse connection.</p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Account Number</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            accounts.map((account) => (
              <TableRow key={account.accountid} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/accounts/${account.accountid}`)}>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell>{account.accountnumber ?? "-"}</TableCell>
                <TableCell>{account.address1_city ?? "-"}</TableCell>
                <TableCell>{account.telephone1 ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={Number(account.statecode) === 0 ? "default" : "secondary"}>
                    {Number(account.statecode) === 0 ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
