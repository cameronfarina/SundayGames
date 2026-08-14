import { describe, expect, it } from "vitest";
import {
  generatePricingModelRunId,
  hashPricingSnapshotInputs,
} from "../../src/platform/pricingSnapshots.js";

describe("pricing snapshot identity", () => {
  it("hashes normalized inputs stably regardless of object key insertion order", () => {
    const firstHash = hashPricingSnapshotInputs({
      modelVersion: "auction-v1",
      league: { season: 2026, settings: { teams: 14, budget: 200 } },
      scenario: { id: "expected", positionFactors: { RB: 1.07, WR: 1.04 } },
    });
    const secondHash = hashPricingSnapshotInputs({
      scenario: { positionFactors: { WR: 1.04, RB: 1.07 }, id: "expected" },
      league: { settings: { budget: 200, teams: 14 }, season: 2026 },
      modelVersion: "auction-v1",
    });
    expect(secondHash).toBe(firstHash);
  });

  it("generates the same model run id for the same league season model version and input hash", () => {
    const inputHash = hashPricingSnapshotInputs({ season: 2026, settings: { teams: 14 } });
    const firstId = generatePricingModelRunId({
      leagueId: "league-100001",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      inputHash,
    });
    const secondId = generatePricingModelRunId({
      inputHash,
      modelVersion: "auction-v1",
      seasonYear: 2026,
      leagueId: "league-100001",
    });
    expect(secondId).toBe(firstId);
  });
});
