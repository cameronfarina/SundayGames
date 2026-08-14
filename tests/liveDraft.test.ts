import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { leagueConfig, ownerOrder, type Position } from "../config/league.js";
import { defaultDraftRoomRankingPath, loadDraftRoomRankings } from "../src/data/draftRoomRankings.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildLiveDraftState, parseLiveDraftSaleCommand, type LiveDraftState } from "../src/modeling/liveDraft.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const fullRosterShape = {
  QB: 2,
  RB: 5,
  WR: 5,
  TE: 2,
  K: 1,
  DST: 1,
} as const satisfies Record<Position, number>;
const rosterFillPositionOrder = ["QB", "RB", "WR", "TE", "K", "DST"] as const satisfies readonly Position[];

const fullDraftCommandsFor = (state: LiveDraftState): string[] => {
  const pools = Object.fromEntries(
    rosterFillPositionOrder.map(position => [
      position,
      state.availableTargets
        .filter(target => target.position === position)
        .map(target => target.name),
    ]),
  ) as Record<Position, string[]>;
  const takePlayer = (position: Position): string => {
    const name = pools[position].shift();
    if (!name) throw new Error(`No ${position} targets left for full-draft regression setup.`);
    return name;
  };

  return ownerOrder.flatMap(owner => {
    const ownerState = state.owners.find(candidate => candidate.owner === owner);
    if (!ownerState) throw new Error(`Missing owner ${owner}.`);

    return rosterFillPositionOrder.flatMap(position => {
      const neededCount = Math.max(0, fullRosterShape[position] - ownerState.positionCounts[position]);
      return Array.from({ length: neededCount }, () =>
        `${owner} drafted ${takePlayer(position)} for 1`,
      );
    });
  });
};

describe("live draft room", () => {
  it("parses natural-language auction sale commands", () => {
    expect(parseLiveDraftSaleCommand("owner05 drafted kittle for 28")).toEqual({
      ownerText: "owner05",
      playerText: "kittle",
      price: 28,
    });
  });

  it("preserves multiword owner and team labels in natural-language sale commands", () => {
    expect(parseLiveDraftSaleCommand("Owner11 Audit drafted Puka Nacua for 62")).toEqual({
      ownerText: "Owner11 Audit",
      playerText: "Puka Nacua",
      price: 62,
    });
    expect(parseLiveDraftSaleCommand("Audit Aces won Jahmyr Gibbs at $74")).toEqual({
      ownerText: "Audit Aces",
      playerText: "Jahmyr Gibbs",
      price: 74,
    });
  });

  it("applies a live Kittle sale from projection fallback data and reprices Owner11 targets", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const initialState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
    });
    const updatedState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      commands: ["owner05 drafted kittle for 28"],
    });

    expect(updatedState.events).toHaveLength(1);
    expect(updatedState.events[0]).toMatchObject({
      owner: "Owner05",
      player: "George Kittle",
      position: "TE",
      price: 28,
      expectedPrice: 2,
      playerSource: "projectionFallback",
    });
    expect(updatedState.owners.find(owner => owner.owner === "Owner05")).toMatchObject({
      spent: 31,
      budgetRemaining: 169,
      rosterSlotsRemaining: 14,
      maxBid: 156,
    });
    expect(updatedState.owners.find(owner => owner.owner === "Owner05")?.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slot: "RB1",
          player: expect.objectContaining({ name: "Quinshon Judkins" }),
        }),
        expect.objectContaining({
          slot: "TE",
          player: expect.objectContaining({ name: "George Kittle" }),
        }),
      ]),
    );
    expect(updatedState.availableTargets.some(target => target.name === "George Kittle")).toBe(false);
    expect(updatedState.room.actualAuctionSpend).toBe(28);
    expect(updatedState.room.expectedAuctionSpend).toBe(2);
    expect(updatedState.room.saleVsExpected).toBe(26);
    expect(updatedState.room.liveInflationFactor).toBeLessThan(initialState.room.liveInflationFactor);
    expect(updatedState.availableTargets[0]?.recommendedMaxBid).toBeLessThanOrEqual(updatedState.watchOwner.maxBid);
    expect(updatedState.postDraftAudit).toHaveLength(1);
    expect(updatedState.postDraftAudit[0]).toMatchObject({
      input: "owner05 drafted kittle for 28",
      owner: "Owner05",
      player: "George Kittle",
      position: "TE",
      price: 28,
      expectedPrice: 2,
      expectedDelta: 26,
      liveExpectedPrice: expect.any(Number),
      liveDelta: expect.any(Number),
      personalValue: expect.any(Number),
      personalDelta: expect.any(Number),
      verdict: "overpay",
    });
    expect(updatedState.postDraftAudit[0]?.personalDelta).toBe(
      28 - (updatedState.postDraftAudit[0]?.personalValue ?? 0),
    );
  });

  it("prioritizes targets from full-season projection and current live price", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const initialState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
    });
    const discountedMarketState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      commands: ["owner05 drafted kittle for 28"],
    });

    const initialGibbs = initialState.availableTargets.find(target => target.name === "Jahmyr Gibbs");
    const discountedGibbs = discountedMarketState.availableTargets.find(target => target.name === "Jahmyr Gibbs");
    const mccaffrey = initialState.availableTargets.find(target => target.name === "Christian McCaffrey");
    const bijan = initialState.availableTargets.find(target => target.name === "Bijan Robinson");

    expect(initialGibbs).toBeDefined();
    expect(discountedGibbs).toBeDefined();
    expect(mccaffrey).toBeDefined();
    expect(bijan).toBeDefined();
    expect(bijan?.seasonProjection).toBeGreaterThan(mccaffrey?.seasonProjection ?? 0);
    expect(mccaffrey?.weeks1To4).toBeGreaterThan(bijan?.weeks1To4 ?? 0);
    expect(bijan?.valueScore).toBeGreaterThan(mccaffrey?.valueScore ?? 0);
    expect(discountedMarketState.room.liveInflationFactor).toBeLessThan(initialState.room.liveInflationFactor);
    expect(discountedGibbs?.liveExpectedPrice).toBeLessThan(initialGibbs?.liveExpectedPrice ?? 0);
    expect(discountedGibbs?.valueScore).toBeGreaterThan(initialGibbs?.valueScore ?? 0);
  });

  it("orders the draft board by expected draft price with season points as the tiebreaker", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
    });

    const topTargets = state.availableTargets.slice(0, 20);

    for (let index = 1; index < topTargets.length; index += 1) {
      const previous = topTargets[index - 1]!;
      const current = topTargets[index]!;
      if (previous.liveExpectedPrice === current.liveExpectedPrice) {
        expect(previous.seasonProjection).toBeGreaterThanOrEqual(current.seasonProjection);
      } else {
        expect(previous.liveExpectedPrice).toBeGreaterThan(current.liveExpectedPrice);
      }
    }
  });

  it("does not inflate leftover player prices after all roster slots are filled", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const setupState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      targetLimit: 600,
    });
    const completedState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      targetLimit: 600,
      commands: fullDraftCommandsFor(setupState),
    });

    expect(completedState.errors).toHaveLength(0);
    expect(completedState.room.remainingRosterSlots).toBe(0);
    expect(completedState.room.liveInflationFactor).toBe(0);
    expect(completedState.availableTargets.length).toBeGreaterThan(0);
    expect(completedState.availableTargets.every(target => target.liveExpectedPrice === 0)).toBe(true);
  });

  it("uses a full-season fallback when projection imports only have Weeks 1-4 totals", async () => {
    const projections = (await loadEspnWeeksOneToFour(projectionPath)).map(projection => {
      if (projection.name !== "Jahmyr Gibbs") return projection;
      const { seasonProjection: _seasonProjection, ...projectionWithoutSeason } = projection;
      return projectionWithoutSeason;
    });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
    });

    const gibbs = state.availableTargets.find(target => target.name === "Jahmyr Gibbs");

    expect(gibbs).toBeDefined();
    expect(gibbs?.seasonProjection).toBeCloseTo((gibbs?.weeks1To4 ?? 0) * 4, 1);
  });

  it("rejects impossible sale commands before changing the live draft state", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const overMaxBidState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      commands: ["owner11 drafted jahmyr gibbs for 999"],
    });
    const overPositionLimitState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      commands: [
        "owner11 drafted josh allen for 1",
        "owner11 drafted lamar jackson for 1",
        "owner11 drafted jayden daniels for 1",
        "owner11 drafted justin herbert for 1",
      ],
    });

    expect(leagueConfig.rosterMaximums).toMatchObject({ QB: 3, RB: 6, WR: 6, TE: 2, K: 2, DST: 2 });
    expect(overMaxBidState.events).toHaveLength(0);
    expect(overMaxBidState.errors[0]?.message).toContain("Owner11 can only bid up to $136");
    expect(overMaxBidState.availableTargets[0]?.name).toBe("Jahmyr Gibbs");
    expect(overPositionLimitState.events).toHaveLength(3);
    expect(overPositionLimitState.errors[0]?.message).toBe("Owner11 cannot buy Justin Herbert: roster limit is 3 QBs.");
  });

  it("keeps room-wide targets visible after Owner11 reaches a position maximum", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      commands: [
        "owner11 drafted josh allen for 1",
        "owner11 drafted lamar jackson for 1",
        "owner11 drafted jayden daniels for 1",
      ],
    });

    const availableQuarterback = state.availableTargets.find(target => target.position === "QB");

    expect(state.watchOwner.positionCounts.QB).toBe(3);
    expect(availableQuarterback).toMatchObject({
      position: "QB",
      personalValue: 0,
      recommendedMaxBid: 0,
      tags: expect.arrayContaining(["roster max"]),
    });
    expect(state.shortlist.some(target => target.position === "QB")).toBe(false);
  });

  it("rejects ambiguous quick-sale player names with explicit match options", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      commands: ["owner11 drafted brown for 12"],
    });

    expect(state.events).toHaveLength(0);
    expect(state.errors[0]?.message).toContain("Ambiguous player \"brown\"");
    expect(state.errors[0]?.message).toContain("A.J. Brown");
    expect(state.errors[0]?.message).toContain("Chase Brown");
  });

  it("exposes board metadata for a simple search-and-add interface", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const draftRoomRankings = await loadDraftRoomRankings(defaultDraftRoomRankingPath);
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      draftRoomRankings,
    });

    const camFirstRunningBackSlot = state.watchOwner.slots.find(slot => slot.slot === "RB1");
    const gibbs = state.availableTargets.find(target => target.name === "Jahmyr Gibbs");
    const puka = state.availableTargets.find(target => target.name === "Puka Nacua");

    expect(camFirstRunningBackSlot?.player).toMatchObject({
      name: "Ashton Jeanty",
      position: "RB",
      price: 50,
    });
    expect(gibbs).toMatchObject({
      position: "RB",
      expectedPrice: 70,
      teamAbbreviation: "DET",
      byeWeek: 6,
      week1Projection: 20.03,
      seasonProjection: 331.2,
      draftRoomRank: {
        sourceLabel: "Average Half PPR",
        platformRank: 1.3,
        fantasyProsRank: 2,
        platformGapVsFantasyPros: -0.33,
        landmineScore: 5.5,
      },
    });
    expect(gibbs?.personalValue).toBe(80);
    expect(gibbs?.strategyValues).toMatchObject({
      balanced: expect.any(Number),
      "three-rb": gibbs?.personalValue,
      "hero-rb": expect.any(Number),
      "wr-heavy": expect.any(Number),
    });
    const receiver = state.availableTargets.find(target => target.position === "WR");
    expect(receiver?.strategyValues["wr-heavy"]).toBeGreaterThanOrEqual(receiver?.strategyValues["three-rb"] ?? 0);
    expect(gibbs?.recommendedMaxBid).toBeLessThanOrEqual(state.watchOwner.maxBid);
    expect(gibbs?.recommendedMaxBid).toBe(76);
    expect(gibbs?.tags).toContain("path max $76");
    expect(puka).toMatchObject({
      position: "WR",
      personalValue: 76,
      recommendedMaxBid: 26,
      tags: expect.arrayContaining(["path max $26"]),
    });
    expect(state.draftPath).toMatchObject({
      strategyKey: "three-rb",
      label: "True 3RB",
      summary: expect.stringContaining("3RB path"),
      maxPriceBands: expect.arrayContaining([
        expect.objectContaining({
          slot: "RB1",
          position: "RB",
          minimumPrice: 50,
          maximumPrice: 76,
          status: "filled",
          filledBy: "Ashton Jeanty",
        }),
        expect.objectContaining({
          slot: "RB2",
          position: "RB",
          minimumPrice: 35,
          maximumPrice: 76,
          status: "next",
        }),
      ]),
      targetClusters: expect.arrayContaining([
        expect.objectContaining({
          label: "Target",
          position: "RB",
          priceBand: "$35-$76",
        }),
      ]),
      pivotRules: expect.arrayContaining([
        expect.objectContaining({
          label: "Pivot",
          action: expect.stringContaining("third RB flex down"),
        }),
      ]),
      riskAlerts: expect.arrayContaining([
        expect.objectContaining({
          label: "RB budget remaining",
          detail: expect.stringContaining("core RB slots"),
        }),
        expect.objectContaining({
          label: "WR value pocket",
          detail: expect.stringContaining("$12-$26"),
        }),
      ]),
      deadZoneWarnings: [],
    });
    expect(state.shortlist[0]).toMatchObject({
      name: "Jahmyr Gibbs",
      position: "RB",
    });
    expect(state.shortlist[0]?.reasons).toContain("starter need");
    expect(state.positionContexts.find(context => context.position === "RB")).toMatchObject({
      position: "RB",
      ownersNeeding: expect.arrayContaining(["Owner11"]),
    });
    expect(state.positionContexts.find(context => context.position === "WR")?.blockers.length).toBeGreaterThan(0);
    expect(state.readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "engine-state", status: "pass" }),
        expect.objectContaining({ key: "target-board", status: "pass" }),
        expect.objectContaining({
          key: "keeper-coverage",
          status: "warn",
          detail: expect.stringContaining("7/14 owners"),
        }),
        expect.objectContaining({ key: "draft-path", status: "pass" }),
      ]),
    );
  });

  it("keeps declared keepers visible as disabled board metadata outside the auction pool", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
    });

    expect(state.availableTargets.some(target => target.name === "Ashton Jeanty")).toBe(false);
    expect(state.keeperTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "Ashton Jeanty",
        position: "RB",
        keeperOwner: "Owner11",
        keeperCost: 50,
        keeperStatus: "confirmed",
        draftable: false,
        tags: expect.arrayContaining(["keeper - Owner11", "confirmed keeper"]),
      }),
    ]));
  });

  it("advances the live 3RB path bands after Owner11 pairs its keeper with a core running back", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      strategyKey: "three-rb",
      commands: ["owner11 drafted jahmyr gibbs for 62"],
    });

    const nextRb = state.availableTargets.find(target => target.position === "RB");

    expect(state.draftPath.maxPriceBands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slot: "RB1",
        status: "filled",
        filledBy: "Jahmyr Gibbs",
      }),
      expect.objectContaining({
        slot: "RB2",
        status: "filled",
        filledBy: "Ashton Jeanty",
        maximumPrice: 76,
      }),
      expect.objectContaining({
        slot: "RB3",
        status: "next",
        maximumPrice: 46,
      }),
    ]));
    expect(nextRb?.recommendedMaxBid).toBeLessThanOrEqual(46);
    expect(nextRb?.tags).toContain("path max $46");
  });

  it("fills the 3RB core after Owner11 adds two auction backs to its keeper", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Owner11",
      scenarioKey: "expected",
      strategyKey: "three-rb",
      commands: [
        "owner11 drafted jahmyr gibbs for 65",
        "owner11 drafted bijan robinson for 65",
      ],
    });

    const nextRb = state.availableTargets.find(target => target.position === "RB");

    expect(state.draftPath.summary).toContain("RB core filled");
    expect(state.draftPath.maxPriceBands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slot: "RB3",
        status: "filled",
        filledBy: "Ashton Jeanty",
      }),
    ]));
    expect(nextRb?.recommendedMaxBid).toBeLessThanOrEqual(state.watchOwner.maxBid);
    expect(nextRb?.tags).not.toEqual(expect.arrayContaining([expect.stringContaining("path max")]));
  });
});
