import { describe, expect, it } from "vitest";

import {
  createGenericAuctionMockState,
  type GenericAuctionMockConfig,
  type GenericAuctionMockPlayer,
} from "../src/platform/genericAuctionMockEngine.js";

const teams = Array.from({ length: 4 }, (_, index) => ({
  id: `team-${index + 1}`,
  name: `Team ${index + 1}`,
}));

const playersFor = (
  position: string,
  count: number,
  offset = 0,
): readonly GenericAuctionMockPlayer[] => Array.from({ length: count }, (_, index) => ({
  id: `${position.toLowerCase()}-${offset + index + 1}`,
  name: `${position} ${offset + index + 1}`,
  position,
  expectedPrice: 1,
}));

const configFor = (
  overrides: Partial<GenericAuctionMockConfig>,
): GenericAuctionMockConfig => ({
  sessionId: "catalog-feasibility",
  seed: "catalog-feasibility",
  humanTeamId: "team-1",
  budgetDollars: 20,
  minimumBidDollars: 1,
  teams,
  rosterSlots: [
    { slot: "QB", count: 1, eligiblePositions: ["QB"] },
    { slot: "RB", count: 1, eligiblePositions: ["RB"] },
  ],
  positionMaximums: { QB: 1, RB: 1 },
  players: [...playersFor("QB", 4), ...playersFor("RB", 4)],
  ...overrides,
});

describe("auction catalog feasibility", () => {
  it("rejects a catalog that cannot fill every dedicated roster slot", () => {
    const config = configFor({
      players: [...playersFor("QB", 3), ...playersFor("RB", 5)],
    });

    expect(() => createGenericAuctionMockState(config)).toThrowError(
      expect.objectContaining({
        code: "invalid_config",
        message: "The player catalog cannot fill every team's remaining roster slots.",
      }),
    );
  });

  it("accepts a catalog whose mixed positions can fill flexible slots", () => {
    const config = configFor({
      rosterSlots: [
        { slot: "QB", count: 1, eligiblePositions: ["QB"] },
        { slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR"] },
      ],
      positionMaximums: { QB: 1, RB: 1, WR: 1 },
      players: [
        ...playersFor("QB", 4),
        ...playersFor("RB", 2),
        ...playersFor("WR", 2),
      ],
    });

    expect(createGenericAuctionMockState(config).teams).toHaveLength(4);
  });

  it("rejects flexible slots when position maximums prevent a full assignment", () => {
    const config = configFor({
      rosterSlots: [{ slot: "FLEX", count: 2, eligiblePositions: ["RB", "WR"] }],
      positionMaximums: { RB: 1, WR: 1 },
      players: playersFor("RB", 8),
    });

    expect(() => createGenericAuctionMockState(config)).toThrowError(
      expect.objectContaining({ code: "invalid_config" }),
    );
  });

  it("validates the remaining catalog after keepers fill roster slots", () => {
    const config = configFor({
      keepers: [{ teamId: "team-1", playerId: "rb-1", price: 2 }],
    });

    const state = createGenericAuctionMockState(config);

    expect(state.teams[0]).toMatchObject({ rosterSlotsRemaining: 1 });
    expect(state.board.players.find(player => player.id === "rb-1"))
      .toMatchObject({ status: "sold" });
  });
});
