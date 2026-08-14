import { vi } from "vitest";
import { leagueConfig, ownerOrder } from "../../config/league.js";
import type { MockBatch } from "../../src/modeling/mockBatch.js";
import { InMemoryJobQueue } from "../../src/platform/jobs.js";
import { buildCurrentMockdLeagueSeason } from "../../src/platform/leagueSeason.js";
import {
  createPlatformApp,
  InMemoryPlatformStore,
} from "../../src/platform/platformApp.js";
import { enqueueSimulationRunExecutionJob } from "../../src/platform/platformJobOrchestrator.js";
import type { SimulationMockBatchRunner } from "../../src/platform/simulations.js";

export const now = new Date("2026-08-09T12:00:00.000Z");

const mockBatch = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}: Parameters<SimulationMockBatchRunner>[0]): MockBatch => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix,
    forcedSales: [...forcedSales],
  },
  runs: [],
  summary: {
    runCount: runsPerScenario,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

export const createSimulationJobFixture = async () => {
  const repository = new InMemoryJobQueue();
  const progressEvents: string[] = [];
  const originalUpdateProgress = repository.updateProgress.bind(repository);
  const updateProgress = vi.spyOn(repository, "updateProgress").mockImplementation(input => {
    progressEvents.push(input.progress.message);
    return originalUpdateProgress(input);
  });
  const runnerCalls: Array<Parameters<SimulationMockBatchRunner>[0]> = [];
  const app = createPlatformApp({
    store: new InMemoryPlatformStore(),
    simulationRunner: options => {
      runnerCalls.push(options);
      progressEvents.push("runner");
      return mockBatch(options);
    },
  });
  const persist = vi.fn(() => {
    progressEvents.push("persist");
  });
  await app.createAccount({ email: "owner11@example.com", password: "owner11 password", now });
  const owner11 = await app.login({
    email: "owner11@example.com",
    password: "owner11 password",
    now,
  });
  if (owner11 === null) throw new Error("Expected owner11@example.com login.");
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "League 100001",
    setupStatus: "published",
  });
  const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
  if (camTeam === undefined) throw new Error("Expected Owner11 team fixture.");
  await app.registerLeagueSeason({
    actorSessionToken: owner11.sessionToken,
    season,
    memberships: [{
      userId: owner11.account.id,
      leagueId: season.leagueId,
      role: "owner",
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
    }],
    now,
  });
  const simulation = await app.createSimulationRun({
    actorSessionToken: owner11.sessionToken,
    leagueId: season.leagueId,
    seasonId: season.id,
    ownerId: camTeam.ownerId,
    teamId: camTeam.id,
    count: 12,
    seedPrefix: "owner11-balanced",
    idempotencyKey: "owner11-balanced",
    strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
    now,
  });
  const workerExecution = vi.spyOn(app, "executeSimulationRunForWorker");
  const job = enqueueSimulationRunExecutionJob({
    repository,
    userId: owner11.account.id,
    leagueId: season.leagueId,
    seasonId: season.id,
    simulationRunId: simulation.id,
    runCount: 12,
    seedPrefix: "owner11-balanced",
    now,
  });
  return {
    app, camTeam, job, owner11, persist, progressEvents, repository,
    runnerCalls, season, simulation, updateProgress, workerExecution,
  };
};
