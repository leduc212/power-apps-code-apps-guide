import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useJobs, type JobStatus } from "@/state/jobs"

/**
 * One toast per job, updated in place as the job moves from running to done.
 * Mounted once in the layout, so it's on screen whatever page the user is on
 * when the job finishes.
 */
export function JobToasts() {
  const jobs = useJobs((s) => s.jobs)
  const dismiss = useJobs((s) => s.dismiss)
  // The status each job's toast is currently showing, so a re-render doesn't re-toast.
  const shown = useRef(new Map<string, JobStatus>())

  useEffect(() => {
    for (const job of Object.values(jobs)) {
      if (shown.current.get(job.key) === job.status) continue
      shown.current.set(job.key, job.status)

      const options = { id: job.key, onDismiss: () => dismiss(job.key), onAutoClose: () => dismiss(job.key) }
      if (job.status === "running") {
        toast.loading(job.label, { ...options, description: "Running. You can keep working.", duration: Infinity })
      } else if (job.status === "success") {
        toast.success(job.label, { ...options, description: job.message ?? "Done.", duration: 6000 })
      } else {
        // Errors stay until dismissed: the user may be on another page when it fails.
        toast.error(job.label, { ...options, description: job.message, duration: Infinity, closeButton: true })
      }
    }
    for (const key of [...shown.current.keys()]) {
      if (!jobs[key]) shown.current.delete(key)
    }
  }, [jobs, dismiss])

  return null
}
