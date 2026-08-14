import { describe, expect, it } from "vitest";

import {
  createGenericAuctionMockState,
  GenericAuctionMockError,
  type GenericAuctionMockConfig,
} from "../src/platform/genericAuctionMockEngine.js";

const configFor = (
  plannedTeamId = "human",
): GenericAuctionMockConfig => ({
  sessionId: "planned-acquisition",
  seed: "planned-acquisition-seed",
  humanTeamId: "human",
  budgetDollars: 20,
  minimumBidDollars: 1,
  teams: [
    { id: "human", name: "Human" },
    { id: "ai-one", name: "AI One" },
    { id: "ai-two", name: "AI Two" },
    { id: "ai-three", name: "AI Three" },
  ],
  rosterSlots: [{ slot: "RB", count: 1, eligiblePositions: ["RB"] }],
  positionMaximums: { RB: 1 },
  players: [
    { id: "target", name: "Target", position: "RB", expectedPrice: 7 },
    { id: "runner-one", name: "Runner One", position: "RB", expectedPrice: 5 },
    { id: "runner-two", name: "Runner Two", position: "RB", expectedPrice: 4 },
    { id: "runner-three", name: "Runner Three", position: "RB", expectedPrice: 3 },
  ],
  plannedAcquisitions: [{ teamId: plannedTeamId, playerId: "target", price: 7 }],
});

describe("generic auction planned acquisition", () => {
  it("reserves the human player's roster slot and budget before bidding", () => {
    const state = createGenericAuctionMockState(configFor());
    const human = state.teams.find(team => team.id === "human");

    expect(human).toMatchObject({
      spent: 7,
      budgetRemaining: 13,
      rosterSlotsRemaining: 0,
      roster: [expect.objectContaining({
        playerId: "target",
        price: 7,
        source: "human",
      })],
    });
    expect(state.board.players.find(player => player.id === "target"))
      .toMatchObject({ status: "sold", available: false });
  });

  it("rejects planned acquisitions assigned to an AI team", () => {
    expect(() => createGenericAuctionMockState(configFor("ai-one")))
      .toThrowError(new GenericAuctionMockError(
        "invalid_config",
        "Planned acquisitions require unique catalog players, the human team, and valid prices.",
      ));
  });
});
