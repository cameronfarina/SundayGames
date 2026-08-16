import { summarizeSeasonSimulation } from "../../../seasonSimulationHttpContract.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { knownError } from "../../responses.js";

export const updateSeasonSimulationOutcome = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  favorite: boolean | undefined,
): Promise<PlatformHttpResponse> => {
  const runNumber = Number(request.segments[3]);
  if (!Number.isInteger(runNumber) || runNumber < 1 || favorite === undefined) {
    return knownError(400, "invalid_favorite", "Choose a valid simulation outcome and favorite state.");
  }
  const run = await app.setSimulationOutcomeFavorite({
    actorSessionToken: request.sessionToken,
    favorite,
    runId: request.segments[1] ?? "",
    runNumber,
    now: request.now,
  });
  const simulation = run.result?.seasonSimulation;
  if (simulation === undefined) {
    return knownError(404, "simulation_not_found", "Simulation outcome was not found.");
  }
  const summary = summarizeSeasonSimulation(
    simulation,
    run.result?.favoriteRunNumbers,
  );
  return {
    status: 200,
    body: {
      historyId: run.id,
      outcome: summary.outcomes.find(outcome => outcome.runNumber === runNumber),
    },
  };
};
