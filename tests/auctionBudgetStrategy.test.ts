import { describe, expect, it } from "vitest";
import type { Position } from "../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
} from "../src/modeling/auctionEngine.js";
import {
  anchorRosterCount,
  playerTargetMaxBidFor,
  positionAnchorRosterCount,
  positionRosterCount,
  positionSpend,
  remainingPlayerTargetBudgetReserveFor,
  strategyBudgetMaxBidFor,
} from "../src/modeling/auctionEngine/budgetStrategy.js";
import type { Player } from "../src/types.js";

const player = (name: string, position: Position, price: number): Player => ({
  name,
  position,
  price,
  week1: 10,
  weeks1To4: 40,
});

describe("auction budget strategy", () => {
  it("accounts for anchors, position slots, and position spend", () => {
    const roster = [
      player("Anchor RB", "RB", 45),
      player("Depth RB", "RB", 10),
      player("Receiver", "WR", 30),
    ];

    expect(anchorRosterCount(roster)).toBe(1);
    expect(positionAnchorRosterCount(roster, "RB")).toBe(1);
    expect(positionRosterCount(roster, "RB")).toBe(2);
    expect(positionSpend(roster, "RB")).toBe(55);
  });

  it("reserves the core envelope for remaining position slots", () => {
    const config = buildAuctionConfig({
      owners: ["Owner01"],
      auctionBudget: 200,
      rosterSize: 3,
      ownerPositionCoreBudgetEnvelopes: {
        Owner01: {
          RB: { targetCount: 3, hardBudget: 120, minimumFutureCorePrice: 25 },
        },
      },
    });
    const state = createAuctionOwnerStates({
      config,
      initialRostersByOwner: { Owner01: [player("First RB", "RB", 30)] },
    })[0];
    if (!state) throw new Error("Expected an owner state.");

    expect(strategyBudgetMaxBidFor(state, player("Second RB", "RB", 60), config)).toBe(65);
  });

  it("does not reserve budget when no future core target remains", () => {
    const config = buildAuctionConfig({
      owners: ["Owner01"],
      ownerPositionCoreTargets: { Owner01: { RB: [60] } },
    });
    const state = createAuctionOwnerStates({ config })[0];
    if (!state) throw new Error("Expected an owner state.");

    expect(strategyBudgetMaxBidFor(state, player("Only Core RB", "RB", 60), config))
      .toBeUndefined();
  });

  it("clamps a named target and reserves its budget while it remains available", () => {
    const config = buildAuctionConfig({
      owners: ["Owner01"],
      auctionBudget: 40,
      rosterSize: 2,
      ownerPlayerTargetMaxBids: { Owner01: { "Target RB": 20.9 } },
    });
    const state = createAuctionOwnerStates({ config })[0];
    if (!state) throw new Error("Expected an owner state.");
    const target = player("Target RB", "RB", 12);
    const candidate = player("Other RB", "RB", 10);

    expect(playerTargetMaxBidFor(state, target, config)).toBe(20);
    expect(remainingPlayerTargetBudgetReserveFor(state, candidate, [target], config))
      .toBe(state.maxBid - 19);
    expect(remainingPlayerTargetBudgetReserveFor(state, target, [], config)).toBeUndefined();
  });
});
