import type { JobHistoryPage } from "../../jobHistory.js";
import type { JobRecord } from "../../jobs.js";
import {
  enqueueSeasonSimulationExecutionJob,
  enqueueSimulationRunExecutionJob,
} from "../../platformJobOrchestrator.js";
import { encodeSeasonSimulationExecutionJobInput } from "../../seasonSimulationJobPayload.js";
import type {
  CancelPlatformJobInput,
  EnqueuePlatformSimulationRunJobInput,
  EnqueuePlatformSeasonSimulationRunJobInput,
  GetPlatformJobInput,
  ListPlatformJobsInput,
  RerunPlatformJobInput,
} from "../contracts/simulation.js";
import type { PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";
import { cloneForRead, simulationRunIdForJob } from "../shared.js";

export const createSimulationJobOperations = (context: PlatformAppContext) => ({
  enqueueSimulationRunExecutionJob: async (
    input: EnqueuePlatformSimulationRunJobInput,
  ): Promise<JobRecord> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const run = await context.simulations.fetchForUser(input.runId, account.id);
    if (run === null) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
    }
    await context.requirePrivateTeamContext(account, run.request);
    return cloneForRead(await enqueueSimulationRunExecutionJob({
      repository: context.jobs,
      userId: account.id,
      leagueId: run.request.leagueId,
      seasonId: run.request.seasonId,
      simulationRunId: run.id,
      runCount: run.request.count,
      seedPrefix: run.request.seedPrefix,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    }));
  },

  enqueueSeasonSimulationRunExecutionJob: async (
    input: EnqueuePlatformSeasonSimulationRunJobInput,
  ): Promise<JobRecord> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const run = await context.simulations.fetchForUser(input.runId, account.id);
    if (run === null) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
    }
    await context.requirePrivateTeamContext(account, run.request);
    const existingJob = (await context.jobs.listForUser(account.id)).find(job =>
      job.kind === "season_simulation" &&
      simulationRunIdForJob(job) === run.id
    );
    if (existingJob !== undefined) return cloneForRead(existingJob);
    try {
      return cloneForRead(await enqueueSeasonSimulationExecutionJob({
        repository: context.jobs,
        userId: account.id,
        leagueId: run.request.leagueId,
        seasonId: run.request.seasonId,
        simulationRunId: run.id,
        runCount: run.request.count,
        seedPrefix: run.request.seedPrefix,
        idempotencyKey: input.idempotencyKey,
        seasonSimulation: encodeSeasonSimulationExecutionJobInput({
          simulationInput: input.simulationInput,
          strategyText: input.strategyText,
          ...(input.note === undefined ? {} : { note: input.note }),
        }),
        now: input.now,
      }));
    } catch (error) {
      try {
        await context.simulations.markFailed(run.id);
      } catch {
        // Preserve the enqueue failure while recording failure when possible.
      }
      throw error;
    }
  },

  listJobs: async (input: ListPlatformJobsInput): Promise<JobHistoryPage> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    return cloneForRead(await context.jobs.listPageForUser({
      userId: account.id,
      cursor: input.cursor,
      limit: input.limit,
    }));
  },

  getJob: async (input: GetPlatformJobInput): Promise<JobRecord> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const job = await context.jobs.fetchForUser(input.jobId, account.id);
    if (job === null) throw new PlatformAppError("private_resource", "This job belongs to another user.");
    return cloneForRead(job);
  },

  cancelJob: async (input: CancelPlatformJobInput): Promise<JobRecord> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const job = await context.jobs.fetchForUser(input.jobId, account.id);
    if (job === null) throw new PlatformAppError("private_resource", "This job belongs to another user.");
    const canceled = await context.jobs.cancelJob({
      jobId: input.jobId,
      userId: account.id,
      now: input.now,
    });
    if (canceled.status === "canceled" || canceled.cancellationRequestedAt !== undefined) {
      const runId = simulationRunIdForJob(canceled);
      if (runId !== null) await context.simulations.markCanceled(runId);
    }
    return cloneForRead(canceled);
  },

  rerunJob: async (input: RerunPlatformJobInput): Promise<JobRecord> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const job = await context.jobs.fetchForUser(input.jobId, account.id);
    if (job === null) throw new PlatformAppError("private_resource", "This job belongs to another user.");
    const rerun = await context.jobs.rerunJob({
      jobId: input.jobId,
      userId: account.id,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    });
    const runId = simulationRunIdForJob(rerun);
    if (rerun.status === "queued" && runId !== null) await context.simulations.resetForRerun(runId);
    return cloneForRead(rerun);
  },
});
