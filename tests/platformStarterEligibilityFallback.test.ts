import { describe, expect, it } from "vitest";

import type { LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";
import { starterEligiblePlayerIdsFor } from "../src/platform/seasonStarterEligibility.js";

const quarterback = (
  name: string,
  teamAbbreviation: string,
  expectedPrice: number,
  week1Projection?: number,
): LiveDraftRoomPlayerCatalogEntry => ({
  name,
  position: "QB",
  expectedPrice,
  teamAbbreviation,
  ...(week1Projection === undefined ? {} : { week1Projection }),
});

describe("starter eligibility projection fallback", () => {
  it("uses one market-ranked player per NFL team when projections are missing", () => {
    const players = [
      quarterback("Detroit Starter", "DET", 20),
      quarterback("Buffalo Starter", "BUF", 18),
      quarterback("Miami Starter", "MIA", 16),
      quarterback("Dallas Starter", "DAL", 14),
      quarterback("Detroit Backup", "DET", 1),
    ];

    expect([...starterEligiblePlayerIdsFor(players)]).toEqual([
      "detroit starter",
      "buffalo starter",
      "miami starter",
      "dallas starter",
    ]);
  });

  it("keeps explicit zero and low projections ineligible when coverage is complete", () => {
    const players = [
      quarterback("Detroit Starter", "DET", 20, 20),
      quarterback("Buffalo Starter", "BUF", 18, 18),
      quarterback("Detroit Backup", "DET", 10, 2),
      quarterback("Buffalo Inactive", "BUF", 1, 0),
    ];

    expect([...starterEligiblePlayerIdsFor(players)]).toEqual([
      "detroit starter",
      "buffalo starter",
    ]);
  });

  it("prioritizes known starters before market-ranked players with missing data", () => {
    const players = [
      quarterback("Detroit Unknown", "DET", 50),
      quarterback("Detroit Starter", "DET", 20, 20),
      quarterback("Buffalo Unknown", "BUF", 18),
      quarterback("Miami Inactive", "MIA", 16, 0),
    ];

    expect([...starterEligiblePlayerIdsFor(players)]).toEqual([
      "detroit starter",
      "buffalo unknown",
    ]);
  });
});
