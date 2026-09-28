import { OpportunitiesService } from "@/generated/services/OpportunitiesService"
import { formattedValue } from "@/lib/dataverse"
import { fetchAllPages } from "@/lib/paging"
import { downloadFile, toCsv } from "@/lib/csv"

export const EXPORT_OPPORTUNITIES_JOB = "export:opportunities"

/**
 * Downloads every opportunity as CSV. Plain async code with no React in it,
 * so it can run as a background job (see `useJobs`) and outlive the page that
 * started it. Returns the success message for the job's toast.
 */
export async function exportOpportunities(): Promise<string> {
  const rows = await fetchAllPages(
    OpportunitiesService.getAll,
    {
      select: ["name", "_parentaccountid_value", "statecode", "salesstage", "opportunityratingcode", "estimatedvalue", "estimatedclosedate"],
      orderBy: ["createdon desc", "opportunityid asc"],
    },
    "Export opportunities",
  )

  const csv = toCsv(
    ["Opportunity", "Account", "Status", "Sales Stage", "Rating", "Est. Value", "Est. Close Date"],
    rows.map((o) => [
      o.name,
      formattedValue(o, "_parentaccountid_value"),
      formattedValue(o, "statecode") ?? o.statecode,
      formattedValue(o, "salesstage") ?? o.salesstage,
      formattedValue(o, "opportunityratingcode") ?? o.opportunityratingcode,
      o.estimatedvalue == null ? "" : Number(o.estimatedvalue),
      o.estimatedclosedate?.slice(0, 10),
    ]),
  )

  downloadFile(csv, `opportunities-${new Date().toISOString().slice(0, 10)}.csv`)
  return `${rows.length.toLocaleString()} opportunities exported.`
}
