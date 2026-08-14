import { describe, expect, it } from "vitest";
import type { Position } from "../config/league.js";
import type { Player } from "../src/types.js";
import type { AuctionOwnerState } from "../src/modeling/auctionEngine/auctionContracts.js";
import { buildAuctionConfig } from "../src/modeling/auctionEngine/buildConfig.js";
import type { PositionAmounts } from "../src/modeling/auctionEngine/configContracts.js";
import {
  buildNominationContext,
  directShortageAfterPickFor,
  emptyPositionBooleans,
  nominationAffordabilityScoreFor,
  nominationContextCanBidOnPlayer,
  nominationFlushMoneyScoreFor,
  nominationNeedScoreForCounts,
  nominationOpponentNeedScoreFor,
  nominationScarcityScoreFor,
} from "../src/modeling/auctionEngine/nominationContext.js";

const positionAmounts = (values: Partial<PositionAmounts> = {}): PositionAmounts => ({
  QB: values.QB ?? 0,
  RB: values.RB ?? 0,
  WR: values.WR ?? 0,
  TE: values.TE ?? 0,
  K: values.K ?? 0,
  DST: values.DST ?? 0,
});

const player = (name: string, position: Position, price: number): Player => ({
  name,
  position,
  price,
  week1: 10,
  weeks1To4: 40,
});

const ownerState = (
  owner: string,
  roster: readonly Player[],
  maxBid: number,
  rosterSlotsRemaining = 3,
): AuctionOwnerState => ({
  owner,
  roster: [...roster],
  spent: 0,
  budgetRemaining: maxBid,
  rosterSlotsRemaining,
  maxBid,
});

const config = buildAuctionConfig({
  owners: ["alpha", "beta", "gamma"],
  auctionBudget: 30,
  rosterSize: 3,
  rosterMaximums: positionAmounts({ QB: 1, RB: 2, WR: 2, TE: 1, K: 0, DST: 0 }),
  starterMinimums: positionAmounts({ QB: 1, RB: 1, WR: 1 }),
  flexMinimum: 0,
  minimumBid: 1,
  reservePriceRatio: 0.75,
});

describe("auction nomination context", () => {
  it("preserves need priority and direct shortage after a candidate pick", () => {
    expect(emptyPositionBooleans()).toEqual({
      QB: false,
      RB: false,
      WR: false,
      TE: false,
      K: false,
      DST: false,
    });
    expect(nominationNeedScoreForCounts("alpha", positionAmounts(), "RB", config)).toBe(1);
    expect(nominationNeedScoreForCounts("alpha", positionAmounts({ QB: 1 }), "QB", config)).toBe(0);
    expect(nominationNeedScoreForCounts("alpha", positionAmounts(), "TE", config)).toBe(0.65);

    const counts = new Map([
      ["alpha", positionAmounts()],
      ["beta", positionAmounts()],
      ["gamma", positionAmounts({ RB: 1 })],
    ]);
    expect(directShortageAfterPickFor("alpha", "RB", counts, config)).toBe(1);
  });

  it("builds owner context in input order with availability and need totals", () => {
    const availablePlayers = [
      player("Alpha RB", "RB", 10),
      player("Beta RB", "RB", 8),
      player("Only QB", "QB", 6),
    ];
    const ownerStates = [
      ownerState("beta", [player("Beta QB", "QB", 1)], 20, 2),
      ownerState("alpha", [player("Alpha WR", "WR", 1)], 20, 2),
      ownerState("gamma", [player("Gamma RB", "RB", 1)], 20, 2),
    ];

    const context = buildNominationContext(availablePlayers, ownerStates, config);

    expect(context.availablePositionCounts).toEqual(positionAmounts({ QB: 1, RB: 2 }));
    expect(context.ownerContexts.map(ownerContext => ownerContext.state.owner)).toEqual([
      "beta",
      "alpha",
      "gamma",
    ]);
    expect(context.ownerContextByOwner.get("alpha")).toBe(context.ownerContexts[1]);
    expect(context.ownersNeedingPosition).toEqual(positionAmounts({
      QB: 2,
      RB: 3,
      WR: 3,
      TE: 3,
    }));
  });

  it("enforces affordability, legal completion, and positional supply", () => {
    const target = player("Target RB", "RB", 10);
    const context = buildNominationContext(
      [target, player("Backup RB", "RB", 7)],
      [
        ownerState("alpha", [player("Alpha QB", "QB", 1)], 5, 2),
        ownerState("beta", [player("Beta QB", "QB", 1)], 20, 2),
        ownerState("gamma", [player("Gamma QB", "QB", 1)], 20, 2),
      ],
      config,
    );
    const alpha = context.ownerContextByOwner.get("alpha");
    if (!alpha) throw new Error("Missing alpha nomination context.");

    expect(nominationContextCanBidOnPlayer(alpha, target, 2, config)).toBe(true);
    expect(nominationContextCanBidOnPlayer(alpha, target, 1, config)).toBe(false);
    expect(nominationAffordabilityScoreFor(alpha, target, 2, config)).toBe(0.5);
    expect(nominationAffordabilityScoreFor(alpha, target, 1, config)).toBe(0);
    expect(nominationAffordabilityScoreFor(alpha, player("Minimum RB", "RB", 1), 2, config)).toBe(1);
  });

  it("scores scarcity and opponent pressure without depending on map iteration order", () => {
    const target = player("Target RB", "RB", 10);
    const context = buildNominationContext(
      [target, player("Backup RB", "RB", 8)],
      [
        ownerState("gamma", [player("Gamma QB", "QB", 1)], 20, 2),
        ownerState("alpha", [player("Alpha QB", "QB", 1)], 20, 2),
        ownerState("beta", [player("Beta QB", "QB", 1)], 4, 2),
      ],
      config,
    );

    expect(nominationScarcityScoreFor("RB", context)).toBe(1);
    expect(nominationOpponentNeedScoreFor("alpha", target, context, config)).toBe(0.5);
    expect(nominationFlushMoneyScoreFor("alpha", target, context, 2, config, 0.8, 0.4)).toBeCloseTo(0.32);
  });
});
