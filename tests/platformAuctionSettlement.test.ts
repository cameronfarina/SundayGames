import { describe, expect, it } from "vitest";

import {
  createGenericAuctionMockState,
  type GenericAuctionMockConfig,
} from "../src/platform/genericAuctionMockEngine.js";
import { requireAdvancedAiBid } from "../src/platform/auction/settlement/advanceAiBid.js";
import {
  progressCurrentNomination,
  settleNomination,
} from "../src/platform/auction/settlement.js";

const config = (): GenericAuctionMockConfig => ({
  sessionId: "settlement-test",
  seed: "settlement-seed",
  humanTeamId: "human",
  budgetDollars: 20,
  minimumBidDollars: 1,
  teams: [
    { id: "human", name: "Human" },
    { id: "ai-1", name: "AI One" },
    { id: "ai-2", name: "AI Two" },
    { id: "ai-3", name: "AI Three" },
  ],
  rosterSlots: [{ slot: "RB", count: 1, eligiblePositions: ["RB"] }],
  positionMaximums: { RB: 1 },
  players: [
    { id: "rb-1", name: "Runner One", position: "RB", expectedPrice: 8 },
    { id: "rb-2", name: "Runner Two", position: "RB", expectedPrice: 6 },
    { id: "rb-3", name: "Runner Three", position: "RB", expectedPrice: 4 },
    { id: "rb-4", name: "Runner Four", position: "RB", expectedPrice: 2 },
  ],
  ai: {
    defaultBidMultiplier: 1,
    rosterNeedDollars: 0,
    randomness: 0,
  },
});

describe("auction settlement", () => {
  it("leaves an idle auction unchanged when there is no nomination to progress", () => {
    const state = createGenericAuctionMockState(config());

    expect(progressCurrentNomination(state)).toEqual({
      state,
      waitingForHuman: false,
    });
  });

  it("rejects settlement when there is no active nomination", () => {
    const state = createGenericAuctionMockState(config());

    expect(() => settleNomination(state)).toThrowError(expect.objectContaining({
      code: "invalid_decision",
    }));
  });

  it("rejects a standing bid that no configured AI team can retain", () => {
    const state = createGenericAuctionMockState(config());
    const nomination = {
      number: 1,
      playerId: "rb-1",
      playerName: "Runner One",
      position: "RB",
      expectedPrice: 8,
      nominatedByTeamId: "human",
      nominatedByTeamName: "Human",
      highestBidderTeamId: "missing-team",
      highestBidderTeamName: "Missing Team",
      currentPrice: 20,
      nextBid: 21,
      humanCanBuy: false,
      humanCanPass: false,
      humanPassed: true,
    };

    expect(() => requireAdvancedAiBid(state, nomination)).toThrowError(
      expect.objectContaining({ code: "no_eligible_player" }),
    );
  });
});
