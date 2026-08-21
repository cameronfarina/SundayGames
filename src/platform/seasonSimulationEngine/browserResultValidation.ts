import { seasonResultValue } from "../platformStoreSnapshotCodec/decoding/seasonResult.js";
import type { SeasonSimulationResult } from "./contracts.js";
import { SeasonSimulationError } from "./contracts.js";

interface IssuedSeasonSimulationLaunch {
  readonly humanTeamId?: string | undefined;
  readonly runCount: number;
  readonly seedPrefix: string;
  readonly teamCount?: number | undefined;
  readonly rosterSize?: number | undefined;
}

const maximumBrowserResultBytes = 2_097_152;

const invalidBrowserResult = (message: string): never => {
  throw new SeasonSimulationError("invalid_configuration", message);
};

export const assertBrowserSeasonSimulationResult = (
  value: unknown,
  issued: IssuedSeasonSimulationLaunch,
): SeasonSimulationResult => {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return invalidBrowserResult("The browser returned an invalid simulation result.");
  }
  if (new TextEncoder().encode(serialized).byteLength > maximumBrowserResultBytes) {
    return invalidBrowserResult("The browser simulation result is too large.");
  }
  let result: SeasonSimulationResult;
  try {
    result = seasonResultValue(value, "simulation");
  } catch {
    return invalidBrowserResult("The browser returned an invalid simulation result.");
  }
  if (result.runCount !== issued.runCount || result.completedCount !== issued.runCount ||
      result.runs.length !== issued.runCount) {
    return invalidBrowserResult("The browser result does not match the issued run count.");
  }
  if (result.seedPrefix !== issued.seedPrefix) {
    return invalidBrowserResult("The browser result does not match the issued seed prefix.");
  }
  for (let index = 0; index < result.runs.length; index += 1) {
    const runNumber = index + 1;
    const run = result.runs[index];
    if (run?.runNumber !== runNumber || run.seed !== `${issued.seedPrefix}:${runNumber}`) {
      return invalidBrowserResult("The browser result contains an invalid seeded run.");
    }
    if (issued.humanTeamId !== undefined) {
      const humanTeams = run.teams.filter(team => team.isUserTeam);
      if (humanTeams.length !== 1 || humanTeams[0]?.teamId !== issued.humanTeamId) {
        return invalidBrowserResult("The browser result does not match the issued team.");
      }
    }
    if (issued.teamCount !== undefined && run.teams.length !== issued.teamCount) {
      return invalidBrowserResult("The browser result does not match the issued league size.");
    }
    if (new Set(run.teams.map(team => team.teamId)).size !== run.teams.length) {
      return invalidBrowserResult("The browser result contains duplicate teams.");
    }
    const rosterSize = issued.rosterSize;
    if (rosterSize !== undefined && run.teams.some(team => team.roster.length > rosterSize)) {
      return invalidBrowserResult("The browser result contains an oversized roster.");
    }
  }
  return result;
};
