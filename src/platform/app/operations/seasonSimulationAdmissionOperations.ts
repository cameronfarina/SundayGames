import { enqueueSeasonSimulationExecutionJob } from "../../platformJobOrchestrator.js";
import { SeasonSimulationError } from "../../seasonSimulationEngine.js";
import { encodeSeasonSimulationExecutionJobInput } from "../../seasonSimulationJobPayload.js";
import type {
  AdmittedPlatformSeasonSimulationRunJob,
  AdmitPlatformSeasonSimulationRunJobInput,
} from "../contracts/simulation.js";
import type { PlatformAppContext } from "../context.js";
import { cloneForRead, simulationRunIdForJob } from "../shared.js";

export const createSeasonSimulationAdmissionOperations = (context: PlatformAppContext) => ({
  getSeasonSimulationQueueHealth: async (input: {
    actorSessionToken: string;
    now?: Date | undefined;
  }) => {
    await context.requireAccount(input.actorSessionToken, input.now);
    const health = await context.jobs.getQueueHealth({ kind: "season_simulation", now: input.now });
    const visibleHealth = context.seasonSimulationAdmissions === undefined
      ? { ...health, workerAvailable: true }
      : health;
    return {
      ...visibleHealth,
      producerEnabled: context.seasonSimulationProducerEnabled,
    };
  },

  admitSeasonSimulationRunExecutionJob: async (
    input: AdmitPlatformSeasonSimulationRunJobInput,
  ): Promise<AdmittedPlatformSeasonSimulationRunJob> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    await context.requirePrivateTeamContext(account, input);
    if (context.seasonSimulationAdmissions !== undefined) {
      return cloneForRead(await context.seasonSimulationAdmissions.admit({
        userId: account.id,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        ownerId: input.ownerId,
        teamId: input.teamId,
        count: input.count,
        seedPrefix: input.seedPrefix,
        idempotencyKey: input.idempotencyKey,
        simulationInput: input.simulationInput,
        strategyText: input.strategyText,
        ...(input.note === undefined ? {} : { note: input.note }),
        now: input.now,
      }));
    }

    const run = await context.simulations.createRequest({
      userId: account.id,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      ownerId: input.ownerId,
      teamId: input.teamId,
      count: input.count,
      seedPrefix: input.seedPrefix,
      idempotencyKey: input.idempotencyKey,
      strategy: {},
      createdAt: input.now,
    });
    const jobs = await context.jobs.listForUser(account.id);
    const existingJob = jobs.find(job =>
      job.kind === "season_simulation" && simulationRunIdForJob(job) === run.id
    );
    const activeJob = jobs.find(job =>
      job.kind === "season_simulation" && (job.status === "queued" || job.status === "running")
    );
    if (existingJob === undefined && activeJob !== undefined) {
      await context.simulations.markFailed(run.id);
      throw new SeasonSimulationError(
        "simulation_account_queue_full",
        "Finish or cancel your active simulation before starting another one.",
      );
    }
    const job = existingJob ?? await enqueueSeasonSimulationExecutionJob({
      repository: context.jobs,
      userId: account.id,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      simulationRunId: run.id,
      runCount: input.count,
      seedPrefix: input.seedPrefix,
      seasonSimulation: encodeSeasonSimulationExecutionJobInput({
        simulationInput: input.simulationInput,
        strategyText: input.strategyText,
        ...(input.note === undefined ? {} : { note: input.note }),
      }),
      now: input.now,
    });
    return cloneForRead({ run, job });
  },
});
