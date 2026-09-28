import { create } from "zustand"

export type JobStatus = "running" | "success" | "error"

export interface Job {
  /** One key per piece of work, e.g. "export:opportunities" or "win:<opportunityid>". */
  key: string
  /** Shown in the toast. */
  label: string
  status: JobStatus
  /** Result or error message, once the job settles. */
  message?: string
}

interface JobsState {
  jobs: Record<string, Job>
  /**
   * Starts `task` unless a job with this key is already running. The task's
   * resolved string (if any) becomes the success message.
   */
  start: (key: string, label: string, task: () => Promise<string | void>) => void
  dismiss: (key: string) => void
}

/**
 * Long-running work (a Power Automate flow, a big export) lives here, not in
 * the component that started it. The promise belongs to this module-level
 * store, so it keeps running when the user navigates away, and any screen can
 * ask whether a job is in flight.
 */
export const useJobs = create<JobsState>((set, get) => {
  const settle = (key: string, status: JobStatus, message?: string) =>
    set((s) => (s.jobs[key] ? { jobs: { ...s.jobs, [key]: { ...s.jobs[key], status, message } } } : s))

  return {
    jobs: {},

    start: (key, label, task) => {
      if (get().jobs[key]?.status === "running") return
      set((s) => ({ jobs: { ...s.jobs, [key]: { key, label, status: "running" } } }))
      task().then(
        (message) => settle(key, "success", message || undefined),
        (error: unknown) => settle(key, "error", error instanceof Error ? error.message : String(error)),
      )
    },

    dismiss: (key) =>
      set((s) => {
        if (!s.jobs[key] || s.jobs[key].status === "running") return s
        const rest = { ...s.jobs }
        delete rest[key]
        return { jobs: rest }
      }),
  }
})

/** True while the job with this key is in flight. Use it to disable the button that starts it. */
export const useIsJobRunning = (key: string) => useJobs((s) => s.jobs[key]?.status === "running")
