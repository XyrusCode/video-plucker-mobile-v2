import { create } from 'zustand';
import YtPluckModule, { addDownloadProgressListener } from 'yt-pluck';
import type { DownloadProgressEvent } from 'yt-pluck';

export type JobEntry = DownloadProgressEvent;

interface JobsState {
  /** jobId → latest progress snapshot. */
  jobs: Record<string, JobEntry>;
  upsert: (event: DownloadProgressEvent) => void;
  remove: (jobId: string) => void;
}

export const useJobs = create<JobsState>()((set) => ({
  jobs: {},
  upsert: (event) =>
    set((s) => {
      const existing = s.jobs[event.jobId];
      if (existing && existing.status === 'COMPLETED') return s;
      return { jobs: { ...s.jobs, [event.jobId]: event } };
    }),
  remove: (jobId) =>
    set((s) => {
      const { [jobId]: _, ...rest } = s.jobs;
      return { jobs: rest };
    }),
}));

let subscribed = false;

/** Wire the native progress stream into the store once. */
export function subscribeToJobEvents() {
  if (subscribed) return;
  subscribed = true;
  addDownloadProgressListener((event) => useJobs.getState().upsert(event));
}

// --- Control wrappers (thin over the native module) ----------------------------------------

export function pauseJob(jobId: string) {
  YtPluckModule.pauseDownloadAsync(jobId);
}

export function resumeJob(jobId: string) {
  YtPluckModule.resumeDownloadAsync(jobId);
}

export function cancelJob(jobId: string) {
  YtPluckModule.cancelDownloadAsync(jobId);
}

export function activeJobCount(jobs: Record<string, JobEntry>): number {
  return Object.values(jobs).filter(
    (j) => j.status === 'RUNNING' || j.status === 'QUEUED'
  ).length;
}