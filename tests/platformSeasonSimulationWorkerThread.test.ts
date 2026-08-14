import { describe, expect, it } from "vitest";

import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  currentLeagueInitialRostersFor,
  loadCurrentPlayerCatalog,
} from "../src/platform/localDemoFixtures.js";
import {
  decodeSeasonSimulationWorkerMessage,
} from "../src/platform/seasonSimulationWorkerThread/decodeMessage.js";
import { runSeasonSimulationWorker } from "../src/platform/seasonSimulationWorkerThread/run.js";

const simulationInput = async () => {
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "Worker decoder test league",
    setupStatus: "published",
  });
  return {
    season,
    setup: {
      seasonId: season.id,
      sourceVersion: "worker-decoder-test",
      playerCatalog: await loadCurrentPlayerCatalog(),
      initialRosters: currentLeagueInitialRostersFor(season),
      contentHash: "worker-decoder-test-hash",
      updatedAt: new Date("2026-08-14T12:00:00.000Z"),
    },
    humanTeamId: season.teams[0]?.id ?? "missing",
    runCount: 1,
    strategyInput: "Target Puka Nacua for no more than $80",
    targetConstraints: [{
      playerName: "Puka Nacua",
      maxAuctionPrice: 80,
      maxSnakeRound: 2,
      maxSnakeOverallPick: 15,
    }],
    seedPrefix: "worker-decoder-test",
    playerExpectedPrices: { "puka-nacua": 55 },
    playerHumanValues: { "puka-nacua": 60 },
    week1Projections: { "puka-nacua": 18 },
  };
};

describe("season simulation worker thread", () => {
  it("rejects malformed unknown worker messages", () => {
    const message: unknown = { input: {} };

    expect(() => decodeSeasonSimulationWorkerMessage(message)).toThrowError(
      "Season simulation worker received an invalid message.",
    );
  });

  it("decodes a legitimate runner message without changing its input", async () => {
    const input = await simulationInput();
    const message: unknown = { input };

    expect(decodeSeasonSimulationWorkerMessage(message)).toEqual(input);
  });

  it("rejects invalid values nested in optional worker input", async () => {
    const input = await simulationInput();
    const message: unknown = {
      input: {
        ...input,
        targetConstraints: [{ playerName: "Puka Nacua", maxAuctionPrice: "$80" }],
      },
    };

    expect(() => decodeSeasonSimulationWorkerMessage(message)).toThrowError(
      "Season simulation worker received an invalid message.",
    );
  });

  it("posts a structured failure for an invalid worker message", () => {
    const postedMessages: unknown[] = [];

    runSeasonSimulationWorker({ input: {} }, message => postedMessages.push(message));

    expect(postedMessages).toEqual([{
      ok: false,
      error: {
        name: "SeasonSimulationWorkerMessageError",
        message: "Season simulation worker received an invalid message.",
      },
    }]);
  });

  it("posts progress and a result for a legitimate worker message", async () => {
    const input = await simulationInput();
    const postedMessages: unknown[] = [];

    runSeasonSimulationWorker({ input }, message => postedMessages.push(message));

    expect(postedMessages).toContainEqual({
      type: "progress",
      progress: { completed: 1, total: 1 },
    });
    expect(postedMessages).toContainEqual({
      ok: true,
      result: expect.objectContaining({ completedCount: 1, runCount: 1 }),
    });
  });
});
