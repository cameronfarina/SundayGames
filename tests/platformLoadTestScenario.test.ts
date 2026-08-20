import { describe, expect, it } from "vitest";
import { platformLoadScenarioForLeagueCount } from "../scripts/platformLoadTest/scenario.js";

describe("platform load-test scenarios", () => {
  it.each([
    [30, 360],
    [50, 600],
  ])("models %i simultaneous 12-manager leagues", (leagueCount, draftClients) => {
    expect(platformLoadScenarioForLeagueCount(leagueCount)).toEqual({
      draftClients,
      draftClientsPerLeague: 12,
      leagueCount,
      newsReaders: 1_000,
      simulationRequests: 25,
    });
  });
});
