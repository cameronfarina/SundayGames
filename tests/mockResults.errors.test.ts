import { describe, expect, it } from "vitest";
import { ownerOrder } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import { buildMockResultsReport } from "../src/modeling/mockResults.js";

const summary: MockBatch["summary"] = {
  runCount: 0,
  scenarios: [],
  players: [],
  owners: [],
  ownerPlayerExposure: [],
};

const emptyBatch = (): MockBatch => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario: 1,
    seedPrefix: "mock-results-errors",
  },
  runs: [],
  summary,
});

describe("mock results errors", () => {
  it("rejects reports without a completed run", () => {
    expect(() => buildMockResultsReport(emptyBatch(), "three-rb"))
      .toThrow("Cannot build mock analytics without runs.");
  });

  it("identifies the first missing roster and run", () => {
    const missingOwner = ownerOrder[0];
    if (!missingOwner) throw new Error("Expected at least one configured owner.");
    const batch = emptyBatch();
    batch.runs.push({
      seed: "mock-results-errors:1",
      keeperScenario: {
        key: "expected",
        label: "Expected",
        includedKeeperStatuses: ["confirmed", "assumed"],
        keeperCounts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
        totalKeeperCost: 0,
        openAuctionDollars: 2800,
        globalFactor: 1,
        positionFactors: { QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DST: 1 },
      },
      inputCounts: { pricedPlayers: 0, auctionPlayers: 0, lockedKeepers: 0 },
      pickCount: 0,
      picks: [],
      budgetTrajectory: [],
      rosters: [],
      invalidRosterCount: 0,
      unsoldPlayerCount: 0,
    });

    expect(() => buildMockResultsReport(batch, "three-rb"))
      .toThrow(`Missing ${missingOwner} roster for mock result run 1.`);
  });
});
