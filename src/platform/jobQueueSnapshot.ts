import { InMemoryJobQueue, type JobRecord } from "./jobs.js";

export interface JobQueueSnapshot {
  readonly jobs: readonly JobRecord[];
}

export const snapshotJobQueue = (queue: InMemoryJobQueue): JobQueueSnapshot => ({
  jobs: queue.jobs(),
});

export const restoreJobQueueSnapshot = (
  queue: InMemoryJobQueue,
  snapshot: JobQueueSnapshot,
): void => {
  queue.replaceJobs(snapshot.jobs);
};

export const createJobQueueFromSnapshot = (snapshot: JobQueueSnapshot): InMemoryJobQueue => {
  const queue = new InMemoryJobQueue();
  restoreJobQueueSnapshot(queue, snapshot);

  return queue;
};
