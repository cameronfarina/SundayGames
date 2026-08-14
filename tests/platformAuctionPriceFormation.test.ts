import { describe, expect, it } from "vitest";

import {
  applyGenericAuctionMockCommand,
  createGenericAuctionMockState,
  type GenericAuctionMockConfig,
} from "../src/platform/genericAuctionMockEngine.js";

const priceFormationConfig = (): GenericAuctionMockConfig => ({
  sessionId: "price-formation",
  seed: "price-formation-seed",
  humanTeamId: "human",
  budgetDollars: 20,
  minimumBidDollars: 1,
  teams: [
    { id: "human", name: "Human" },
    { id: "bidder", name: "Bidder" },
    { id: "filled-one", name: "Filled One" },
    { id: "filled-two", name: "Filled Two" },
  ],
  rosterSlots: [{ slot: "RB", count: 1, eligiblePositions: ["RB"] }],
  positionMaximums: { RB: 1 },
  players: [
    { id: "target", name: "Target RB", position: "RB", expectedPrice: 2 },
    { id: "fallback", name: "Fallback RB", position: "RB", expectedPrice: 1 },
    { id: "keeper-one", name: "Keeper One", position: "RB", expectedPrice: 1 },
    { id: "keeper-two", name: "Keeper Two", position: "RB", expectedPrice: 1 },
  ],
  keepers: [
    { teamId: "filled-one", playerId: "keeper-one", price: 1 },
    { teamId: "filled-two", playerId: "keeper-two", price: 1 },
  ],
  ai: {
    defaultBidMultiplier: 1,
    rosterNeedDollars: 0,
    randomness: 0,
    spendPacingExcludedPlayerIds: ["target"],
    targetEndingBudgetDollars: 0,
  },
});

describe("auction price formation", () => {
  it("does not turn spend pacing into bids from a team that is already winning", () => {
    const setup = createGenericAuctionMockState(priceFormationConfig());
    const started = applyGenericAuctionMockCommand(setup, {
      type: "start",
      expectedRevision: 0,
    });
    const nominated = applyGenericAuctionMockCommand(started, {
      type: "nominate",
      expectedRevision: started.session.revision,
      playerId: "target",
      openingBid: 1,
    });

    expect(nominated.session.currentNomination).toMatchObject({
      currentPrice: 2,
      highestBidderTeamId: "bidder",
    });

    const passed = applyGenericAuctionMockCommand(nominated, {
      type: "pass",
      expectedRevision: nominated.session.revision,
    });

    expect(passed.sales.find(sale => sale.playerId === "target")).toMatchObject({
      teamId: "bidder",
      price: 2,
    });
    expect(passed.auctionEvents.filter(event => event.type === "bid"))
      .toEqual([expect.objectContaining({ teamId: "bidder", price: 2 })]);
  });
});
