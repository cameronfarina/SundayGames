import { describe, expect, it } from "vitest";

import {
  createGenericAuctionMockState,
  isAutomatedAuctionAcquisitionEligible,
  type GenericAuctionMockConfig,
} from "../src/platform/genericAuctionMockEngine.js";
import { isStarterEligible } from "../src/platform/auction/starterEligibility.js";

const config: GenericAuctionMockConfig = {
  sessionId: "starter-eligibility",
  seed: "starter-eligibility-seed",
  humanTeamId: "team-a",
  budgetDollars: 20,
  minimumBidDollars: 1,
  teams: [
    { id: "team-a", name: "Human" },
    { id: "team-b", name: "AI One" },
    { id: "team-c", name: "AI Two" },
    { id: "team-d", name: "AI Three" },
  ],
  rosterSlots: [{ slot: "QB", count: 1, eligiblePositions: ["QB"] }],
  positionMaximums: { QB: 1 },
  players: [
    {
      id: "buffalo-starter",
      name: "Buffalo Starter",
      position: "QB",
      teamAbbreviation: "BUF",
      expectedPrice: 10,
      projectedStarter: true,
    },
    {
      id: "buffalo-backup",
      name: "Buffalo Backup",
      position: "QB",
      teamAbbreviation: "BUF",
      expectedPrice: 1,
      projectedStarter: false,
      starterEligible: false,
    },
    {
      id: "baltimore-starter",
      name: "Baltimore Starter",
      position: "QB",
      teamAbbreviation: "BAL",
      expectedPrice: 9,
      starterEligible: true,
    },
    {
      id: "cincinnati-starter",
      name: "Cincinnati Starter",
      position: "QB",
      teamAbbreviation: "CIN",
      expectedPrice: 8,
      starterEligible: true,
    },
    {
      id: "kansas-city-starter",
      name: "Kansas City Starter",
      position: "QB",
      teamAbbreviation: "KC",
      expectedPrice: 7,
      starterEligible: true,
    },
  ],
};

describe("auction starter eligibility", () => {
  it("allows a starting NFL player into a dedicated slot and rejects the ineligible backup", () => {
    const state = createGenericAuctionMockState(config);
    const team = state.teams.find(candidate => candidate.id === "team-b");
    const starter = state.board.players.find(player => player.id === "buffalo-starter");
    const backup = state.board.players.find(player => player.id === "buffalo-backup");

    if (team === undefined || starter === undefined || backup === undefined) {
      throw new Error("Expected starter eligibility fixtures to exist.");
    }

    expect(isStarterEligible(starter)).toBe(true);
    expect(isStarterEligible(backup)).toBe(false);
    expect(isAutomatedAuctionAcquisitionEligible(state, team, starter)).toBe(true);
    expect(isAutomatedAuctionAcquisitionEligible(state, team, backup)).toBe(false);
  });
});
