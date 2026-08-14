import { describe, expect, it } from "vitest";

import {
  applyGenericAuctionMockCommand,
  createGenericAuctionMockState,
  type GenericAuctionMockConfig,
  type GenericAuctionMockState,
} from "../src/platform/genericAuctionMockEngine.js";

const config: GenericAuctionMockConfig = {
  sessionId: "command-validation",
  seed: "command-validation-seed",
  humanTeamId: "human",
  budgetDollars: 20,
  minimumBidDollars: 1,
  teams: [
    { id: "human", name: "Human" },
    { id: "ai-1", name: "AI One" },
    { id: "ai-2", name: "AI Two" },
    { id: "ai-3", name: "AI Three" },
  ],
  rosterSlots: [{ slot: "QB", count: 1, eligiblePositions: ["QB"] }],
  positionMaximums: { QB: 1 },
  players: [
    { id: "qb-1", name: "QB One", position: "QB", expectedPrice: 8 },
    { id: "qb-2", name: "QB Two", position: "QB", expectedPrice: 6 },
    { id: "qb-3", name: "QB Three", position: "QB", expectedPrice: 4 },
    { id: "qb-4", name: "QB Four", position: "QB", expectedPrice: 2 },
  ],
  ai: {
    defaultBidMultiplier: 1,
    rosterNeedDollars: 0,
    randomness: 0,
  },
};

const setup = () => createGenericAuctionMockState(config);
const start = () => applyGenericAuctionMockCommand(
  setup(),
  { type: "start", expectedRevision: 0 },
);
const nominate = () => applyGenericAuctionMockCommand(
  start(),
  { type: "nominate", expectedRevision: 1, playerId: "qb-1", openingBid: 1 },
);

describe("auction command validation", () => {
  it("rejects a repeated start", () => {
    expect(() => applyGenericAuctionMockCommand(start(), {
      type: "start",
      expectedRevision: 1,
    })).toThrowError(expect.objectContaining({ code: "invalid_status" }));
  });

  it("rejects auction decisions before the draft starts", () => {
    expect(() => applyGenericAuctionMockCommand(setup(), {
      type: "pass",
      expectedRevision: 0,
    })).toThrowError(expect.objectContaining({ code: "invalid_status" }));
  });

  it("rejects a nomination while bidding is in progress", () => {
    expect(() => applyGenericAuctionMockCommand(nominate(), {
      type: "nominate",
      expectedRevision: 2,
      playerId: "qb-2",
    })).toThrowError(expect.objectContaining({ code: "invalid_decision" }));
  });

  it("uses the configured minimum bid when an opening bid is omitted", () => {
    const state = applyGenericAuctionMockCommand(start(), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "qb-1",
    });

    expect(state.auctionEvents.find(event => event.type === "nomination")?.price).toBe(1);
  });

  it("rejects a bid phase without an active nomination", () => {
    const started = start();
    const inconsistent: GenericAuctionMockState = {
      ...started,
      session: { ...started.session, phase: "awaiting_human_bid", currentNomination: undefined },
    };

    expect(() => applyGenericAuctionMockCommand(inconsistent, {
      type: "pass",
      expectedRevision: 1,
    })).toThrowError(expect.objectContaining({ code: "invalid_decision" }));
  });

  it("rejects a human bid below the next legal amount", () => {
    expect(() => applyGenericAuctionMockCommand(nominate(), {
      type: "buy",
      expectedRevision: 2,
      price: 1,
    })).toThrowError(expect.objectContaining({ code: "invalid_price" }));
  });
});
