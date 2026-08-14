import type { JobRecord } from "./contracts.js";
import { idempotencyIndexKey } from "./identifiers.js";

const indexKeyFor = (job: JobRecord): string =>
  idempotencyIndexKey(job.userId, job.leagueId, job.seasonId, job.idempotencyKey);

export class InMemoryJobStore {
  readonly #jobsById = new Map<string, JobRecord>();
  readonly #jobIdsByIdempotencyKey = new Map<string, string>();

  jobById(jobId: string): JobRecord | undefined {
    return this.#jobsById.get(jobId);
  }

  jobByIdempotencyKey(indexKey: string): JobRecord | undefined {
    const jobId = this.#jobIdsByIdempotencyKey.get(indexKey);

    return jobId === undefined ? undefined : this.#jobsById.get(jobId);
  }

  values(): JobRecord[] {
    return [...this.#jobsById.values()];
  }

  store(job: JobRecord): void {
    this.#jobsById.set(job.id, job);
    this.#jobIdsByIdempotencyKey.set(indexKeyFor(job), job.id);
  }

  remove(job: JobRecord): void {
    this.#jobsById.delete(job.id);
    this.#jobIdsByIdempotencyKey.delete(indexKeyFor(job));
  }

  snapshots(): readonly JobRecord[] {
    return this.values().map(job => structuredClone(job));
  }

  replace(jobs: readonly JobRecord[]): void {
    this.#jobsById.clear();
    this.#jobIdsByIdempotencyKey.clear();

    for (const job of jobs) {
      this.store(structuredClone(job));
    }
  }
}
