import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AccountsService } from "@/generated/services/AccountsService"
import { OpportunitiesService } from "@/generated/services/OpportunitiesService"
import { ContactsService } from "@/generated/services/ContactsService"
import { formattedValue, unwrap } from "@/lib/dataverse"
import { CopyLinkButton } from "@/components/copy-link-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const RATING_LABELS: Record<number, string> = { 1: "Hot", 2: "Warm", 3: "Cold" }

export default function AccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [form, setForm] = useState({ name: "", estimatedvalue: "", estimatedclosedate: "", rating: "" })

  // Fetch the account record
  const { data: account, isLoading: loadingAccount, error: accountError } = useQuery({
    queryKey: ["account", accountId],
    queryFn: async () => {
      const result = await AccountsService.get(accountId!)
      return unwrap(result, "Load account")
    },
    enabled: !!accountId,
  })

  // Fetch related opportunities
  const { data: opportunities = [], isLoading: loadingOpps, error: oppsError } = useQuery({
    queryKey: ["opportunities", accountId],
    queryFn: async () => {
      const result = await OpportunitiesService.getAll({
        select: ["name", "estimatedvalue", "estimatedclosedate", "opportunityratingcode", "statecode"],
        filter: `_parentaccountid_value eq ${accountId}`,
        orderBy: ["createdon desc"],
      })
      return unwrap(result, "Load opportunities")
    },
    enabled: !!accountId,
  })

  // Fetch related contacts
  const { data: contacts = [], isLoading: loadingContacts, error: contactsError } = useQuery({
    queryKey: ["contacts", accountId],
    queryFn: async () => {
      const result = await ContactsService.getAll({
        select: ["fullname", "firstname", "lastname", "jobtitle", "emailaddress1", "telephone1"],
        filter: `_accountid_value eq ${accountId}`,
        orderBy: ["lastname asc"],
      })
      return unwrap(result, "Load contacts")
    },
    enabled: !!accountId,
  })

  // Create opportunity mutation
  const createOpportunity = useMutation({
    mutationFn: async () => {
      const result = await OpportunitiesService.create({
        name: form.name,
        "customerid_account@odata.bind": `/accounts(${accountId})`,
        statecode: 0,
        ...(form.estimatedvalue && { estimatedvalue: Number(form.estimatedvalue) }),
        ...(form.estimatedclosedate && { estimatedclosedate: form.estimatedclosedate }),
        ...(form.rating && { opportunityratingcode: Number(form.rating) }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      return unwrap(result, "Create opportunity")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", accountId] })
      setShowCreateDialog(false)
      setForm({ name: "", estimatedvalue: "", estimatedclosedate: "", rating: "" })
    },
    onError: (error) => toast.error(`Could not create the opportunity: ${error.message}`),
  })

  // Delete opportunity mutation
  const deleteOpportunity = useMutation({
    // The generated delete() returns void and drops the SDK result, so a failed
    // delete can't be detected here yet (see docs/v2-audit.md, 4.10).
    mutationFn: (opportunityId: string) => OpportunitiesService.delete(opportunityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", accountId] })
    },
    onError: (error) => toast.error(`Could not delete the opportunity: ${error.message}`),
  })

  if (loadingAccount) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
    )
  }

  if (accountError) {
    return <div className="p-6 text-sm text-destructive">Failed to load the account: {accountError.message}</div>
  }

  if (!account) {
    return <div className="p-6 text-muted-foreground">Account not found.</div>
  }

  return (
    <div className="p-6 space-y-6">

      {/* Back button + Account header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/accounts")}>
          ← Accounts
        </Button>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">{account.name}</h1>
          <CopyLinkButton />
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          {account.accountnumber && <span>#{account.accountnumber}</span>}
          {account.address1_city && <span>{account.address1_city}</span>}
          {account.telephone1 && <span>{account.telephone1}</span>}
          <Badge variant={Number(account.statecode) === 0 ? "default" : "secondary"}>
            {Number(account.statecode) === 0 ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      {/* Related records in tabs */}
      <Tabs defaultValue="opportunities">
        <TabsList>
          <TabsTrigger value="opportunities">
            Opportunities {!loadingOpps && `(${opportunities.length})`}
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts {!loadingContacts && `(${contacts.length})`}
          </TabsTrigger>
        </TabsList>

        {/* Opportunities tab */}
        <TabsContent value="opportunities" className="space-y-4 mt-4">
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            + New Opportunity
          </Button>

          {oppsError && (
            <p className="text-sm text-destructive">Failed to load opportunities: {oppsError.message}</p>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Est. Value</TableHead>
                <TableHead>Close Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingOpps ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                opportunities.map((opp) => (
                  <TableRow key={opp.opportunityid}>
                    <TableCell className="font-medium">{opp.name}</TableCell>
                    <TableCell>
                      {formattedValue(opp, "opportunityratingcode") ?? RATING_LABELS[Number(opp.opportunityratingcode)] ?? "-"}
                    </TableCell>
                    <TableCell>
                      {opp.estimatedvalue ? `$${Number(opp.estimatedvalue).toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell>
                      {opp.estimatedclosedate ? new Date(opp.estimatedclosedate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deleteOpportunity.isPending}
                        onClick={() => deleteOpportunity.mutate(opp.opportunityid)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Contacts tab */}
        <TabsContent value="contacts" className="space-y-4 mt-4">
          {contactsError && (
            <p className="text-sm text-destructive">Failed to load contacts: {contactsError.message}</p>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingContacts ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.contactid}>
                    <TableCell className="font-medium">
                      {contact.fullname ?? `${contact.firstname ?? ""} ${contact.lastname}`.trim()}
                    </TableCell>
                    <TableCell>{contact.jobtitle ?? "-"}</TableCell>
                    <TableCell>{contact.emailaddress1 ?? "-"}</TableCell>
                    <TableCell>{contact.telephone1 ?? "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Create Opportunity dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Opportunity</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                placeholder="Opportunity name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Estimated Value</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.estimatedvalue}
                onChange={(e) => setForm(f => ({ ...f, estimatedvalue: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Close Date</Label>
              <Input
                type="date"
                value={form.estimatedclosedate}
                onChange={(e) => setForm(f => ({ ...f, estimatedclosedate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Rating</Label>
              <Select value={form.rating} onValueChange={(v) => setForm(f => ({ ...f, rating: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Hot</SelectItem>
                  <SelectItem value="2">Warm</SelectItem>
                  <SelectItem value="3">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.name || createOpportunity.isPending}
              onClick={() => createOpportunity.mutate()}
            >
              {createOpportunity.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
