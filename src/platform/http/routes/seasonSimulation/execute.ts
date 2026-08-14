import { randomUUID } from "node:crypto";
import { runSeasonSimulations } from "../../../seasonSimulationEngine.js";
import type { SeasonSimulationProgress } from "../../../seasonSimulationEngine.js";
import { summarizeSeasonSimulation } from "../../../seasonSimulationHttpContract.js";
import type { PlatformApp, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import type { PreparedSeasonSimulation } from "./prepare.js";

export const executeAndStoreSeasonSimulation = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  prepared: PreparedSeasonSimulation,
  onProgress?: (progress: SeasonSimulationProgress) => void,
) => {
  const simulation = services.seasonSimulationRunner === undefined
    ? runSeasonSimulations(prepared.input, { onProgress })
    : await services.seasonSimulationRunner(prepared.input, {
        accountId: prepared.accountId,
        signal: request.signal,
        onProgress,
      });
  const createdAt = request.now ?? new Date();
  const storedRun = await app.createSimulationRun({
    actorSessionToken: request.sessionToken,
    leagueId: prepared.leagueId,
    seasonId: prepared.seasonId,
    ownerId: prepared.ownerId,
    teamId: prepared.teamId,
    count: prepared.runCount,
    seedPrefix: prepared.seedPrefix,
    idempotencyKey: `season-simulation:${randomUUID()}`,
    strategy: {},
    now: createdAt,
  });
  const completedRun = await app.completeSeasonSimulationRun({
    actorSessionToken: request.sessionToken,
    runId: storedRun.id,
    result: {
      runId: storedRun.id,
      requestId: storedRun.request.id,
      completedAt: createdAt,
      runCount: prepared.runCount,
      seedPrefix: prepared.seedPrefix,
      hardLockCount: 0,
      softTargetCount: 0,
      forcedSales: [],
      summary: { runCount: prepared.runCount, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
      seasonSimulation: simulation,
      strategyText: prepared.strategyInput,
      ...(prepared.note === undefined ? {} : { note: prepared.note }),
    },
    now: createdAt,
  });
  return {
    historyId: completedRun.id,
    summary: summarizeSeasonSimulation(simulation),
    ...(prepared.note === undefined ? {} : { note: prepared.note }),
  };
};
