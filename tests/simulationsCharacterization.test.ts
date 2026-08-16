import { describe, expect, it } from "vitest";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import type { SeasonSimulationResult } from "../src/platform/seasonSimulationEngine.js";
import {
  InMemorySimulationRepository,
  executeSimulationRun,
  type CreateSimulationRequestInput,
} from "../src/platform/simulations.js";

const createdAt = new Date("2026-08-14T12:00:00.000Z");

const requestInput = (userId: string, idempotencyKey: string): CreateSimulationRequestInput => ({
  userId,
  leagueId: "league_sunday_games",
  seasonId: "season_2026",
  ownerId: `owner_${userId}`,
  teamId: `team_${userId}`,
  count: 25,
  seedPrefix: "balanced",
  idempotencyKey,
  strategy: {
    hardLocks: [{ playerName: "Jared Goff", price: 7, priceMode: "ceiling" }],
    softTargets: [{ label: "RB value", candidatePool: ["Jadarian Price"], maxBid: 15 }],
  },
  createdAt,
});

const batch = (): MockBatch => ({
  options: { scenarioKeys: ["expected"], runsPerScenario: 25, seedPrefix: "balanced" },
  runs: [],
  summary: { runCount: 25, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
});

const seasonResult = (): SeasonSimulationResult => ({
  draftFormat: "auction",
  runCount: 25,
  completedCount: 25,
  seedPrefix: "balanced",
  strategy: {
    rawInput: "target Jared Goff",
    preferredPositions: [],
    summary: "Target Jared Goff.",
    warnings: [],
  },
  playerExposure: [],
  positionCounts: {},
  runs: [{
    runNumber: 1,
    label: "Run 1",
    seed: "balanced-1",
    teams: [{
      teamId: "team_cam",
      teamName: "Short King",
      isUserTeam: true,
      roster: [],
      week1Points: 111.8,
    }],
  }],
});

describe("simulation repository characterization", () => {
  it("keeps list payloads private and strips result bodies from general history", async () => {
    const repository = new InMemorySimulationRepository();
    const owned = repository.createRequest(requestInput("cam", "owned"));
    repository.createRequest(requestInput("other", "other"));
    await executeSimulationRun({ repository, runId: owned.id, runner: batch, now: createdAt });

    expect(repository.listForUser("cam")).toEqual([
      expect.objectContaining({ id: owned.id, privacyOwnerUserId: "cam", result: undefined }),
    ]);
    expect(repository.fetchForUser(owned.id, "other")).toBeNull();
    expect(repository.fetchForUser(owned.id, "cam")?.result?.summary.runCount).toBe(25);
  });

  it("keeps season summaries while stripping detailed run rosters from season history", async () => {
    const repository = new InMemorySimulationRepository();
    const run = repository.createRequest(requestInput("cam", "season-history"));
    const completed = await executeSimulationRun({ repository, runId: run.id, runner: batch, now: createdAt });
    if (completed.result === undefined) throw new Error("Expected a completed result.");
    completed.result.seasonSimulation = seasonResult();

    const history = repository.listHistoryForUserSeason("cam", "season_2026", 25);

    expect(history[0]?.result?.seasonSimulation).toMatchObject({
      runCount: 25,
      completedCount: 25,
      runs: [{ teams: [{ isUserTeam: true, roster: [] }] }],
    });
    expect(repository.fetchForUser(run.id, "cam")?.result?.seasonSimulation?.runs).toHaveLength(1);
  });

  it("preserves terminal states across cancellation, failure, completion, and rerun transitions", () => {
    const repository = new InMemorySimulationRepository();
    const canceled = repository.createRequest(requestInput("cam", "canceled"));
    repository.markRunning(canceled.id, createdAt);
    repository.markCanceled(canceled.id);
    expect(repository.markFailed(canceled.id).status).toBe("canceled");

    const completed = repository.createRequest(requestInput("cam", "completed"));
    completed.status = "completed";
    expect(repository.markCanceled(completed.id).status).toBe("completed");

    const failed = repository.createRequest(requestInput("cam", "failed"));
    repository.markFailed(failed.id);
    expect(repository.resetForRerun(failed.id)).toMatchObject({
      status: "requested",
      startedAt: undefined,
      completedAt: undefined,
      result: undefined,
    });
  });
});
