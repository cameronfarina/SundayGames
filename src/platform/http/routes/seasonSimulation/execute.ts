import {
  assertBrowserSeasonSimulationResult,
  SeasonSimulationError,
} from "../../../seasonSimulationEngine.js";
import { summarizeSeasonSimulation } from "../../../seasonSimulationHttpContract.js";
import { hashSimulationInput } from "../../../simulations.js";
import type { PlatformApp } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString } from "../../request/values.js";
import type { PreparedSeasonSimulation } from "./prepare.js";
import type { SimulationRun } from "../../../simulations.js";

export const seasonSimulationLaunchBody = (
  run: SimulationRun,
  requestId: string,
) => ({
  historyId: run.id,
  requestId,
  input: run.request.browserInput,
  inputDigest: run.request.browserInputDigest,
  ...(run.request.browserNote === undefined ? {} : { note: run.request.browserNote }),
});

export const createSeasonSimulationLaunch = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  prepared: PreparedSeasonSimulation,
  requestId: string,
) => {
  const createdAt = request.now ?? new Date();
  const browserInputDigest = hashSimulationInput({ input: prepared.input, note: prepared.note });
  const storedRun = await app.createSimulationRun({
    actorSessionToken: request.sessionToken,
    leagueId: prepared.leagueId,
    seasonId: prepared.seasonId,
    ownerId: prepared.ownerId,
    teamId: prepared.teamId,
    count: prepared.runCount,
    seedPrefix: prepared.seedPrefix,
    idempotencyKey: `season-simulation:${requestId}`,
    strategy: {},
    browserInput: prepared.input,
    browserInputDigest,
    browserNote: prepared.note,
    now: createdAt,
  });
  return seasonSimulationLaunchBody(storedRun, requestId);
};

export const completeSeasonSimulationLaunch = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  runId: string,
) => {
  const issuedRun = await app.getSimulationRun({
    actorSessionToken: request.sessionToken,
    runId,
    now: request.now,
  });
  if (issuedRun.status === "canceled") {
    throw new SeasonSimulationError("simulation_canceled", "This simulation launch was canceled.");
  }
  if (issuedRun.result?.seasonSimulation !== undefined) {
    return {
      historyId: issuedRun.id,
      summary: summarizeSeasonSimulation(
        issuedRun.result.seasonSimulation,
        issuedRun.result.favoriteRunNumbers,
      ),
      ...(issuedRun.result.note === undefined ? {} : { note: issuedRun.result.note }),
    };
  }
  const simulation = assertBrowserSeasonSimulationResult(request.body.simulation, {
    runCount: issuedRun.request.count,
    seedPrefix: issuedRun.request.seedPrefix,
    humanTeamId: issuedRun.request.teamId,
    teamCount: issuedRun.request.browserInput?.season.settings.expectedTeamCount,
    rosterSize: issuedRun.request.browserInput?.season.settings.roster.rosterSize,
  });
  if (request.body.inputDigest !== issuedRun.request.browserInputDigest) {
    throw new SeasonSimulationError(
      "invalid_configuration",
      "The completion does not match the server-prepared simulation input.",
    );
  }
  const completedAt = request.now ?? new Date();
  const note = optionalString(request.body.note);
  const completedRun = await app.completeSeasonSimulationRun({
    actorSessionToken: request.sessionToken,
    runId,
    result: {
      runId,
      requestId: issuedRun.request.id,
      completedAt,
      runCount: issuedRun.request.count,
      seedPrefix: issuedRun.request.seedPrefix,
      hardLockCount: 0,
      softTargetCount: 0,
      forcedSales: [],
      summary: {
        runCount: issuedRun.request.count,
        scenarios: [],
        players: [],
        owners: [],
        ownerPlayerExposure: [],
      },
      seasonSimulation: simulation,
      strategyText: simulation.strategy.rawInput,
      ...(note === undefined ? {} : { note }),
    },
    now: completedAt,
  });
  const completedSimulation = completedRun.result?.seasonSimulation;
  if (completedSimulation === undefined) {
    if (completedRun.status === "canceled") {
      throw new SeasonSimulationError("simulation_canceled", "This simulation launch was canceled.");
    }
    throw new SeasonSimulationError("simulation_failed", "The simulation result was not saved.");
  }
  return {
    historyId: completedRun.id,
    summary: summarizeSeasonSimulation(completedSimulation),
    ...(note === undefined ? {} : { note }),
  };
};
