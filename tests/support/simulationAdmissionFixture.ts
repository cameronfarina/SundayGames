import { leagueConfig, ownerOrder } from "../../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../../src/platform/leagueSeason.js";
import { createPlatformApp, InMemoryPlatformStore } from "../../src/platform/platformApp.js";
import { createPlatformHttpHandler } from "../../src/platform/platformHttp.js";
import type { SimulationMockBatchRunner } from "../../src/platform/simulations.js";

export const simulationAdmissionNow = new Date("2026-08-13T18:00:00.000Z");

const runner: SimulationMockBatchRunner = options => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario: options.runsPerScenario,
    seedPrefix: options.seedPrefix,
    forcedSales: [...options.forcedSales],
  },
  runs: [],
  summary: {
    runCount: options.runsPerScenario,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

export const simulationAdmissionFixture = async () => {
  const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: runner });
  const account = await app.createAccount({
    email: "simulation-admission@example.com",
    password: "secure password1!",
    now: simulationAdmissionNow,
  });
  const login = await app.login({
    email: account.email,
    password: "secure password1!",
    now: simulationAdmissionNow,
  });
  if (login === null) throw new Error("Expected simulation admission login.");
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "Simulation Admission",
    setupStatus: "published",
  });
  const team = season.teams.find(candidate => candidate.ownerDisplayName === "Owner11");
  if (team === undefined) throw new Error("Expected the primary synthetic team.");
  await app.registerLeagueSeason({
    actorSessionToken: login.sessionToken,
    season,
    memberships: [{
      userId: account.id,
      leagueId: season.leagueId,
      role: "owner",
      ownerId: team.ownerId,
      teamId: team.id,
    }],
    now: simulationAdmissionNow,
  });
  return {
    app,
    handle: createPlatformHttpHandler(app),
    sessionToken: login.sessionToken,
    season,
    team,
  };
};
