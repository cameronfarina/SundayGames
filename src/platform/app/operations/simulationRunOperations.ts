import type { SimulationRun } from "../../simulations.js";
import { executeSimulationRun } from "../../simulations.js";
import type {
  CompletePlatformSeasonSimulationRunInput,
  CreatePlatformSimulationRunInput,
  ExecutePlatformSimulationRunForWorkerInput,
  ExecutePlatformSimulationRunInput,
  GetPlatformSimulationRunInput,
  ListPlatformSimulationRunsInput,
  SetPlatformSimulationOutcomeFavoriteInput,
} from "../contracts/simulation.js";
import type { PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";
import { cloneForRead } from "../shared.js";

export const createSimulationRunOperations = (context: PlatformAppContext) => ({
  createSimulationRun: async (input: CreatePlatformSimulationRunInput): Promise<SimulationRun> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    await context.requirePrivateTeamContext(account, input);
    return cloneForRead(await context.simulations.createRequest({
      userId: account.id,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      ownerId: input.ownerId,
      teamId: input.teamId,
      count: input.count,
      seedPrefix: input.seedPrefix,
      idempotencyKey: input.idempotencyKey,
      strategy: input.strategy,
      createdAt: input.now,
    }));
  },

  executeSimulationRun: async (input: ExecutePlatformSimulationRunInput): Promise<SimulationRun> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const run = await context.simulations.fetchForUser(input.runId, account.id);
    if (run === null) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
    }
    await context.requirePrivateTeamContext(account, run.request);
    return cloneForRead(await executeSimulationRun({
      repository: context.simulations,
      runId: input.runId,
      runner: context.simulationRunner,
      now: input.now,
    }));
  },

  completeSeasonSimulationRun: async (
    input: CompletePlatformSeasonSimulationRunInput,
  ): Promise<SimulationRun> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const run = await context.simulations.fetchForUser(input.runId, account.id);
    if (run === null) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
    }
    await context.requirePrivateTeamContext(account, run.request);
    await context.simulations.markRunning(run.id, input.now ?? new Date());
    try {
      return cloneForRead(await context.simulations.complete(run.id, input.result));
    } catch (error) {
      try {
        await context.simulations.markFailed(run.id);
      } catch {
        // Preserve the completion failure while recording failure when possible.
      }
      throw error;
    }
  },

  executeSimulationRunForWorker: async (
    input: ExecutePlatformSimulationRunForWorkerInput,
  ): Promise<SimulationRun> => {
    const run = await context.simulations.find(input.runId);
    if (
      run.privacyOwnerUserId !== input.userId
      || run.request.leagueId !== input.leagueId
      || run.request.seasonId !== input.seasonId
    ) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
    }
    const account = await context.authRepository.findAccountById(input.userId);
    if (account === null) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to a missing account.");
    }
    await context.requirePrivateTeamContext(account, run.request);
    return cloneForRead(await executeSimulationRun({
      repository: context.simulations,
      runId: input.runId,
      runner: context.simulationRunner,
      now: input.now,
    }));
  },

  listSimulationRuns: async (
    input: ListPlatformSimulationRunsInput,
  ): Promise<readonly SimulationRun[]> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const runs = input.seasonId === undefined
      ? await context.simulations.listForUser(account.id)
      : await context.simulations.listHistoryForUserSeason(
        account.id,
        input.seasonId,
        input.historyLimit ?? 25,
      );
    const readableRuns: SimulationRun[] = [];
    for (const run of runs) {
      if (await context.canReadPrivateTeamContext(account, run.request)) readableRuns.push(run);
    }
    return readableRuns.map(cloneForRead);
  },

  getSimulationRun: async (input: GetPlatformSimulationRunInput): Promise<SimulationRun> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const run = await context.simulations.fetchForUser(input.runId, account.id);
    if (run === null) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
    }
    await context.requirePrivateTeamContext(account, run.request);
    return cloneForRead(run);
  },

  setSimulationOutcomeFavorite: async (
    input: SetPlatformSimulationOutcomeFavoriteInput,
  ): Promise<SimulationRun> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const run = await context.simulations.fetchForUser(input.runId, account.id);
    if (run === null) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
    }
    await context.requirePrivateTeamContext(account, run.request);
    return cloneForRead(await context.simulations.setOutcomeFavorite(
      run.id,
      input.runNumber,
      input.favorite,
    ));
  },
});
