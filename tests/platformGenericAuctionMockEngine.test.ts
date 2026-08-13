import { describe, expect, it } from "vitest";

import {
  applyGenericAuctionMockCommand,
  createGenericAuctionMockState,
  replayGenericAuctionMock,
  type GenericAuctionMockConfig,
} from "../src/platform/genericAuctionMockEngine.js";

const baseConfig = (
  overrides: Partial<GenericAuctionMockConfig> = {},
): GenericAuctionMockConfig => ({
  sessionId: "auction-session",
  seed: "auction-seed",
  humanTeamId: "team-a",
  budgetDollars: 20,
  minimumBidDollars: 1,
  teams: [
    { id: "team-a", name: "Cam" },
    { id: "team-b", name: "Beaton" },
    { id: "team-c", name: "Seth" },
    { id: "team-d", name: "PJ" },
  ],
  rosterSlots: [
    { slot: "QB", count: 1, eligiblePositions: ["QB"] },
    { slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR"] },
  ],
  positionMaximums: { QB: 1, RB: 2, WR: 2 },
  players: [
    { id: "qb-1", name: "QB One", position: "QB", expectedPrice: 8 },
    { id: "rb-1", name: "RB One", position: "RB", expectedPrice: 7 },
    { id: "wr-1", name: "WR One", position: "WR", expectedPrice: 6 },
    { id: "qb-2", name: "QB Two", position: "QB", expectedPrice: 5 },
    { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 4 },
    { id: "wr-2", name: "WR Two", position: "WR", expectedPrice: 3 },
    { id: "qb-3", name: "QB Three", position: "QB", expectedPrice: 2 },
    { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 0 },
    { id: "wr-3", name: "WR Three", position: "WR", expectedPrice: 0 },
    { id: "qb-4", name: "QB Four", position: "QB", expectedPrice: 1 },
  ],
  ai: {
    defaultBidMultiplier: 1,
    rosterNeedDollars: 0,
    randomness: 0,
  },
  ...overrides,
});

const start = (config: GenericAuctionMockConfig = baseConfig()) =>
  applyGenericAuctionMockCommand(
    createGenericAuctionMockState(config),
    { type: "start", expectedRevision: 0 },
  );

describe("generic auction mock engine", () => {
  it("supports arbitrary team names and every league size from four through twenty", () => {
    const configFor = (teamCount: number): GenericAuctionMockConfig => {
      const teams = Array.from({ length: teamCount }, (_, index) => ({
        id: `owner-${index + 1}`,
        name: index === 0 ? "The Human Team" : `Opponent ${index + 1}`,
      }));

      return baseConfig({
        sessionId: `auction-${teamCount}`,
        teams,
        humanTeamId: teams[0]?.id ?? "missing",
        rosterSlots: [{ slot: "UTILITY", count: 1, eligiblePositions: ["ANY"] }],
        positionMaximums: { ANY: 1 },
        players: Array.from({ length: teamCount }, (_, index) => ({
          id: `player-${index + 1}`,
          name: `Player ${index + 1}`,
          position: "ANY",
          expectedPrice: index + 1,
        })),
      });
    };

    expect(createGenericAuctionMockState(configFor(4)).teams).toHaveLength(4);
    expect(createGenericAuctionMockState(configFor(20)).teams).toHaveLength(20);
    expect(() => createGenericAuctionMockState(configFor(3)))
      .toThrowError(expect.objectContaining({ code: "invalid_config" }));
    expect(() => createGenericAuctionMockState(configFor(21)))
      .toThrowError(expect.objectContaining({ code: "invalid_config" }));
  });

  it("builds a browser-ready setup projection with arbitrary roster slots and position caps", () => {
    const state = createGenericAuctionMockState(baseConfig({
      rosterSlots: [
        { slot: "SUPERFLEX", count: 2, eligiblePositions: ["QB", "RB", "WR"] },
      ],
      positionMaximums: { QB: 1, RB: 2, WR: 2 },
    }));

    expect(state.session).toMatchObject({
      id: "auction-session",
      status: "setup",
      phase: "not_started",
      revision: 0,
      humanTeamId: "team-a",
      canUndo: false,
      canComplete: false,
    });
    expect(state.board.players[0]).toMatchObject({
      id: "qb-1",
      expectedPrice: 8,
      status: "available",
      available: true,
    });
    expect(state.teams[0]).toMatchObject({
      id: "team-a",
      name: "Cam",
      isHuman: true,
      budgetDollars: 20,
      spent: 0,
      budgetRemaining: 20,
      rosterSlotsRemaining: 2,
      maxBid: 19,
      positionCounts: { QB: 0, RB: 0, WR: 0 },
    });
    expect(state.teams[0]?.slots.map(slot => slot.slot)).toEqual(["SUPERFLEX1", "SUPERFLEX2"]);
    expect(state.sales).toEqual([]);
  });

  it("starts at the first meaningful human decision and checks revisions", () => {
    const setup = createGenericAuctionMockState(baseConfig());

    expect(() => applyGenericAuctionMockCommand(setup, {
      type: "start",
      expectedRevision: 1,
    })).toThrowError(expect.objectContaining({ code: "stale_revision" }));

    const started = applyGenericAuctionMockCommand(setup, {
      type: "start",
      expectedRevision: 0,
    });

    expect(started.session).toMatchObject({
      status: "active",
      phase: "awaiting_human_nomination",
      revision: 1,
      nextNominatorTeamId: "team-a",
    });
    expect(started.session.currentNomination).toBeUndefined();
    expect(setup.session).toMatchObject({ status: "setup", revision: 0, commandLog: [] });
  });

  it("lets the human nominate, then automatically resolves AI bidding to a buy/pass decision", () => {
    const started = start();
    const nominated = applyGenericAuctionMockCommand(started, {
      type: "nominate",
      expectedRevision: 1,
      playerId: "qb-1",
      openingBid: 1,
    });

    expect(nominated.session).toMatchObject({
      phase: "awaiting_human_bid",
      revision: 2,
      canUndo: true,
      currentNomination: {
        number: 1,
        playerId: "qb-1",
        playerName: "QB One",
        position: "QB",
        expectedPrice: 8,
        nominatedByTeamId: "team-a",
        highestBidderTeamId: "team-b",
        currentPrice: 8,
        nextBid: 9,
        humanCanBuy: true,
        humanCanPass: true,
      },
    });
    expect(nominated.board.players.find(player => player.id === "qb-1"))
      .toMatchObject({ status: "nominated", available: false });
    expect(nominated.auctionEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "nomination",
        playerId: "qb-1",
        teamId: "team-a",
        price: 1,
      }),
      expect.objectContaining({
        type: "bid",
        playerId: "qb-1",
        teamId: "team-b",
        price: 8,
      }),
    ]));
  });

  it("never shows an AI owner outbidding itself in the reconstructed bid feed", () => {
    const config = baseConfig({
      budgetDollars: 100,
      teams: [
        { id: "team-a", name: "Cam" },
        { id: "team-b", name: "Beaton", aiTendency: { bidMultiplier: 1.5 } },
        { id: "team-c", name: "Seth", aiTendency: { bidMultiplier: 1.44 } },
        { id: "team-d", name: "PJ", aiTendency: { bidMultiplier: 1.4 } },
      ],
      rosterSlots: [{ slot: "RB", count: 1, eligiblePositions: ["RB"] }],
      positionMaximums: { RB: 1 },
      players: [
        { id: "target", name: "Target RB", position: "RB", expectedPrice: 50 },
        { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 30 },
        { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 20 },
        { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 10 },
      ],
      ai: { defaultBidMultiplier: 1, rosterNeedDollars: 0, randomness: 0 },
    });
    const nominated = applyGenericAuctionMockCommand(start(config), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "target",
      openingBid: 1,
    });
    const bidEvents = nominated.auctionEvents.filter(event => event.type === "bid");

    expect(new Set(bidEvents.map(event => event.teamId)).size).toBeGreaterThan(1);
    expect(bidEvents.every((event, index) => (
      index === 0 || event.teamId !== bidEvents[index - 1]?.teamId
    ))).toBe(true);
  });

  it("accepts a human buy, sells when AI will not counter, and advances automatically", () => {
    const nominated = applyGenericAuctionMockCommand(start(), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "qb-1",
      openingBid: 1,
    });
    const bought = applyGenericAuctionMockCommand(nominated, {
      type: "buy",
      expectedRevision: 2,
      price: 10,
    });

    expect(bought.sales[0]).toMatchObject({
      number: 1,
      playerId: "qb-1",
      teamId: "team-a",
      price: 10,
      source: "human",
      nominatedByTeamId: "team-a",
    });
    expect(bought.teams.find(team => team.id === "team-a")).toMatchObject({
      spent: 10,
      budgetRemaining: 10,
      rosterSlotsRemaining: 1,
      maxBid: 10,
    });
    expect(bought.teams.find(team => team.id === "team-a")?.roster[0])
      .toMatchObject({ playerId: "qb-1", rosterSlot: "QB", price: 10 });
    expect(bought.board.players.find(player => player.id === "qb-1"))
      .toMatchObject({ status: "sold", available: false });
    expect(bought.session.phase).toBe("awaiting_human_bid");
    expect(bought.session.currentNomination?.nominatedByTeamId).toBe("team-b");
  });

  it("automatically counters a human bid when an AI ceiling is higher", () => {
    const config = baseConfig({
      teams: [
        { id: "team-a", name: "Cam" },
        {
          id: "team-b",
          name: "WR Collector",
          aiTendency: { positionBidMultipliers: { WR: 2 } },
        },
        { id: "team-c", name: "Seth" },
        { id: "team-d", name: "PJ" },
      ],
    });
    const nominated = applyGenericAuctionMockCommand(start(config), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "wr-1",
      openingBid: 1,
    });
    const countered = applyGenericAuctionMockCommand(nominated, {
      type: "buy",
      expectedRevision: 2,
      price: 8,
    });

    expect(countered.sales).toEqual([]);
    expect(countered.session.currentNomination).toMatchObject({
      highestBidderTeamId: "team-b",
      currentPrice: 9,
      nextBid: 10,
      humanCanBuy: true,
    });
  });

  it("lets the human pass and settles the standing AI sale before the next decision", () => {
    const nominated = applyGenericAuctionMockCommand(start(), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "qb-1",
      openingBid: 1,
    });
    const passed = applyGenericAuctionMockCommand(nominated, {
      type: "pass",
      expectedRevision: 2,
    });

    expect(passed.sales[0]).toMatchObject({
      playerId: "qb-1",
      teamId: "team-b",
      price: 8,
      source: "ai",
    });
    expect(passed.session.revision).toBe(3);
    expect(passed.session.currentNomination?.nominatedByTeamId).toBe("team-b");
    expect(passed.session.phase).toBe("awaiting_human_bid");
    expect(passed.auctionEvents).toEqual(expect.arrayContaining([
      ...[5, 4, 3, 2, 1].map(countdown => expect.objectContaining({
        type: "countdown",
        playerId: "qb-1",
        countdown,
      })),
      expect.objectContaining({
        type: "sold",
        playerId: "qb-1",
        teamId: "team-b",
        price: 8,
      }),
    ]));
  });

  it("raises AI ceilings as a position becomes depleted", () => {
    const teams = [
      { id: "team-a", name: "Cam" },
      { id: "team-b", name: "Beaton" },
      { id: "team-c", name: "Seth" },
      { id: "team-d", name: "PJ" },
    ];
    const players = [
      { id: "target", name: "Target RB", position: "RB", expectedPrice: 50 },
      ...Array.from({ length: 11 }, (_, index) => ({
        id: `rb-${index + 1}`,
        name: `Running Back ${index + 1}`,
        position: "RB",
        expectedPrice: Math.max(1, 38 - index * 3),
      })),
    ];
    const config = baseConfig({
      teams,
      budgetDollars: 200,
      rosterSlots: [{ slot: "RB", count: 2, eligiblePositions: ["RB"] }],
      positionMaximums: { RB: 2 },
      players,
      ai: { defaultBidMultiplier: 1, rosterNeedDollars: 0, randomness: 0 },
    });
    const abundant = applyGenericAuctionMockCommand(start(config), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "target",
      openingBid: 1,
    });
    const scarce = applyGenericAuctionMockCommand(start({
      ...config,
      sessionId: "scarce-auction",
      keepers: teams.map((team, index) => ({
        teamId: team.id,
        playerId: `rb-${index + 1}`,
        price: 1,
      })),
    }), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "target",
      openingBid: 1,
    });

    expect(abundant.session.currentNomination?.currentPrice).toBe(50);
    expect(scarce.session.currentNomination?.currentPrice)
      .toBeGreaterThan(abundant.session.currentNomination?.currentPrice ?? 0);
  });

  it("lets a team with a cheap keeper use its budget advantage in bidding", () => {
    const config = baseConfig({
      humanTeamId: "team-a",
      budgetDollars: 100,
      rosterSlots: [{ slot: "RB", count: 2, eligiblePositions: ["RB"] }],
      positionMaximums: { RB: 2 },
      players: [
        { id: "target", name: "Target RB", position: "RB", expectedPrice: 40 },
        { id: "cheap-keeper", name: "Cheap Keeper", position: "RB", expectedPrice: 30 },
        { id: "costly-keeper", name: "Costly Keeper", position: "RB", expectedPrice: 30 },
        { id: "other-keeper", name: "Other Keeper", position: "RB", expectedPrice: 30 },
        { id: "human-keeper", name: "Human Keeper", position: "RB", expectedPrice: 30 },
        { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 25 },
        { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 20 },
        { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 15 },
      ],
      keepers: [
        { teamId: "team-a", playerId: "human-keeper", price: 50 },
        { teamId: "team-b", playerId: "cheap-keeper", price: 5 },
        { teamId: "team-c", playerId: "costly-keeper", price: 45 },
        { teamId: "team-d", playerId: "other-keeper", price: 50 },
      ],
      ai: {
        defaultBidMultiplier: 1,
        rosterNeedDollars: 0,
        randomness: 0,
        targetEndingBudgetDollars: 0,
      },
    });
    const nominated = applyGenericAuctionMockCommand(start(config), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "target",
      openingBid: 1,
    });

    expect(nominated.sales.find(sale => sale.playerId === "target"))
      .toMatchObject({ teamId: "team-b" });
    expect(nominated.sales.find(sale => sale.playerId === "target")?.price).toBeGreaterThan(40);
  });

  it("uses owner tendencies to produce deterministic AI bidding personalities", () => {
    const config = baseConfig({
      teams: [
        { id: "team-a", name: "Cam" },
        {
          id: "team-b",
          name: "WR Collector",
          aiTendency: { positionBidMultipliers: { WR: 2 } },
        },
        { id: "team-c", name: "Seth" },
        { id: "team-d", name: "PJ" },
      ],
    });
    const nominated = applyGenericAuctionMockCommand(start(config), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "wr-1",
      openingBid: 1,
    });
    const passed = applyGenericAuctionMockCommand(nominated, {
      type: "pass",
      expectedRevision: 2,
    });

    expect(nominated.session.currentNomination).toMatchObject({
      highestBidderTeamId: "team-b",
      currentPrice: 7,
    });
    expect(passed.sales[0]).toMatchObject({ teamId: "team-b", playerId: "wr-1", price: 7 });
  });

  it("centers competitive AI clearing prices around the expected market price", () => {
    const teams = Array.from({ length: 14 }, (_, index) => ({
      id: `team-${index + 1}`,
      name: index === 0 ? "Cam" : `Opponent ${index}`,
    }));
    const config = baseConfig({
      teams,
      humanTeamId: teams[0]?.id ?? "missing",
      budgetDollars: 200,
      rosterSlots: [{ slot: "RB", count: 1, eligiblePositions: ["RB"] }],
      positionMaximums: { RB: 1 },
      players: Array.from({ length: 14 }, (_, index) => ({
        id: index === 0 ? "jahmyr-gibbs" : `running-back-${index + 1}`,
        name: index === 0 ? "Jahmyr Gibbs" : `Running Back ${index + 1}`,
        position: "RB",
        expectedPrice: index === 0 ? 76 : Math.max(1, 50 - index),
      })),
      ai: {
        defaultBidMultiplier: 1,
        rosterNeedDollars: 1,
        randomness: 0.08,
      },
    });
    const nominated = applyGenericAuctionMockCommand(start(config), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "jahmyr-gibbs",
      openingBid: 1,
    });
    const sold = applyGenericAuctionMockCommand(nominated, {
      type: "pass",
      expectedRevision: 2,
    });

    expect(sold.sales[0]).toMatchObject({ playerId: "jahmyr-gibbs", source: "ai" });
    expect(sold.sales[0]?.price).toBeGreaterThanOrEqual(72);
    expect(sold.sales[0]?.price).toBeLessThanOrEqual(80);
  });

  it("preserves the standing AI bidder when opponents have equal bid ceilings", () => {
    const config = baseConfig({
      teams: [
        { id: "team-a", name: "Cam" },
        { id: "team-c", name: "Seth" },
        { id: "team-b", name: "Beaton" },
        { id: "team-d", name: "PJ" },
      ],
    });
    const afterHumanSale = applyGenericAuctionMockCommand(start(config), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "rb-3",
      openingBid: 1,
    });

    expect(afterHumanSale.session.currentNomination).toMatchObject({
      nominatedByTeamId: "team-c",
      highestBidderTeamId: "team-c",
      currentPrice: 8,
    });
  });

  it("preloads keepers before start without changing team economics when the draft starts", () => {
    const setup = createGenericAuctionMockState(baseConfig({
      keepers: [
        { teamId: "team-a", playerId: "rb-1", price: 10 },
        { teamId: "team-b", playerId: "qb-1", price: 8 },
      ],
    }));
    const human = setup.teams.find(team => team.id === "team-a");

    expect(human).toMatchObject({
      spent: 10,
      budgetRemaining: 10,
      rosterSlotsRemaining: 1,
      maxBid: 10,
    });
    expect(human?.roster[0]).toMatchObject({
      playerId: "rb-1",
      price: 10,
      source: "keeper",
      rosterSlot: "FLEX",
    });
    expect(setup.board.players.find(player => player.id === "rb-1"))
      .toMatchObject({ status: "sold", available: false });
    expect(setup.sales[0]).toMatchObject({ playerId: "rb-1", source: "keeper" });

    const started = applyGenericAuctionMockCommand(setup, {
      type: "start",
      expectedRevision: 0,
    });
    expect(started.teams).toEqual(setup.teams);
    expect(started.board).toEqual(setup.board);
    expect(started.sales).toEqual(setup.sales);
  });

  it("rejects bids above max bid and nominations that violate position or slot limits", () => {
    const keeperConfig = baseConfig({
      rosterSlots: [
        { slot: "QB", count: 1, eligiblePositions: ["QB"] },
        { slot: "BENCH", count: 1, eligiblePositions: ["QB", "RB", "WR"] },
      ],
      keepers: [{ teamId: "team-a", playerId: "qb-2", price: 10 }],
    });
    const started = start(keeperConfig);

    expect(started.teams.find(team => team.id === "team-a")?.maxBid).toBe(10);
    expect(() => applyGenericAuctionMockCommand(started, {
      type: "nominate",
      expectedRevision: 1,
      playerId: "qb-1",
      openingBid: 1,
    })).toThrowError(expect.objectContaining({ code: "position_limit" }));

    const rbNomination = applyGenericAuctionMockCommand(started, {
      type: "nominate",
      expectedRevision: 1,
      playerId: "rb-1",
      openingBid: 1,
    });
    expect(() => applyGenericAuctionMockCommand(rbNomination, {
      type: "buy",
      expectedRevision: 2,
      price: 11,
    })).toThrowError(expect.objectContaining({ code: "max_bid_exceeded" }));
  });

  it("rejects duplicate or unaffordable keepers before exposing setup state", () => {
    expect(() => createGenericAuctionMockState(baseConfig({
      keepers: [
        { teamId: "team-a", playerId: "rb-1", price: 5 },
        { teamId: "team-b", playerId: "rb-1", price: 5 },
      ],
    }))).toThrowError(expect.objectContaining({ code: "duplicate_player" }));

    expect(() => createGenericAuctionMockState(baseConfig({
      keepers: [{ teamId: "team-a", playerId: "rb-1", price: 20 }],
    }))).toThrowError(expect.objectContaining({ code: "max_bid_exceeded" }));
  });

  it("undoes the latest human decision and every automatic consequence after it", () => {
    const started = start();
    const nominated = applyGenericAuctionMockCommand(started, {
      type: "nominate",
      expectedRevision: 1,
      playerId: "rb-3",
      openingBid: 1,
    });

    expect(nominated.sales[0]).toMatchObject({ playerId: "rb-3", teamId: "team-a" });
    expect(nominated.session.currentNomination?.nominatedByTeamId).toBe("team-b");

    const undone = applyGenericAuctionMockCommand(nominated, {
      type: "undo",
      expectedRevision: 2,
    });

    expect(undone.session).toMatchObject({
      revision: 3,
      phase: "awaiting_human_nomination",
      nextNominatorTeamId: "team-a",
      canUndo: false,
    });
    expect(undone.session.currentNomination).toBeUndefined();
    expect(undone.sales).toEqual([]);
    expect(undone.board.players.find(player => player.id === "rb-3"))
      .toMatchObject({ status: "available", available: true });
    expect(undone.teams.find(team => team.id === "team-a")?.roster).toEqual([]);
  });

  it("runs AI-only decisions to a ready state and completes explicitly", () => {
    const config = baseConfig({
      rosterSlots: [{ slot: "UTILITY", count: 1, eligiblePositions: ["QB", "RB", "WR"] }],
      positionMaximums: { QB: 1, RB: 1, WR: 1 },
      keepers: [{ teamId: "team-a", playerId: "rb-3", price: 1 }],
    });
    const ready = start(config);

    expect(ready.session).toMatchObject({
      status: "active",
      phase: "ready_to_complete",
      currentNomination: undefined,
      canComplete: true,
    });
    expect(ready.teams.every(team => team.rosterSlotsRemaining === 0)).toBe(true);
    expect(ready.sales).toHaveLength(4);

    const completed = applyGenericAuctionMockCommand(ready, {
      type: "complete",
      expectedRevision: 1,
    });
    expect(completed.session).toMatchObject({
      status: "completed",
      phase: "completed",
      revision: 2,
      canComplete: false,
      canUndo: false,
    });
  });

  it("reranks paced AI bidders when the human cannot afford the next bid", () => {
    const config = baseConfig({
      humanTeamId: "team-b",
      teams: [
        { id: "team-a", name: "Low Budget AI", aiTendency: { bidMultiplier: 10 } },
        { id: "team-b", name: "Human" },
        { id: "team-c", name: "High Budget AI" },
        { id: "team-d", name: "Keeper AI" },
      ],
      rosterSlots: [{ slot: "RB", count: 2, eligiblePositions: ["RB"] }],
      positionMaximums: { RB: 2 },
      players: [
        { id: "target", name: "Target", position: "RB", expectedPrice: 1 },
        ...Array.from({ length: 7 }, (_, index) => ({
          id: `runner-${index + 1}`,
          name: `Runner ${index + 1}`,
          position: "RB",
          expectedPrice: 0,
        })),
      ],
      keepers: [
        { teamId: "team-a", playerId: "runner-1", price: 15 },
        { teamId: "team-b", playerId: "runner-2", price: 18 },
        { teamId: "team-d", playerId: "runner-3", price: 19 },
      ],
      ai: {
        defaultBidMultiplier: 1,
        rosterNeedDollars: 0,
        randomness: 0,
        spendPacingExcludedPlayerIds: ["target"],
        targetEndingBudgetDollars: 0,
      },
    });

    const state = start(config);

    expect(state.sales.find(sale => sale.playerId === "target")).toMatchObject({
      playerId: "target",
      teamId: "team-c",
      price: 12,
    });
  });

  it("rejects completion while teams still have open roster slots", () => {
    const active = start();
    expect(() => applyGenericAuctionMockCommand(active, {
      type: "complete",
      expectedRevision: 1,
    })).toThrowError(expect.objectContaining({ code: "draft_incomplete" }));
  });

  it("deterministically replays accepted commands, AI actions, and undo", () => {
    const config = baseConfig();
    const started = start(config);
    const nominated = applyGenericAuctionMockCommand(started, {
      type: "nominate",
      expectedRevision: 1,
      playerId: "rb-3",
      openingBid: 1,
    });
    const undone = applyGenericAuctionMockCommand(nominated, {
      type: "undo",
      expectedRevision: 2,
    });
    const replacement = applyGenericAuctionMockCommand(undone, {
      type: "nominate",
      expectedRevision: 3,
      playerId: "qb-1",
      openingBid: 1,
    });
    const passed = applyGenericAuctionMockCommand(replacement, {
      type: "pass",
      expectedRevision: 4,
    });

    expect(replayGenericAuctionMock(config, passed.session.commandLog)).toEqual(passed);
    expect(replayGenericAuctionMock(config, passed.session.commandLog)).toEqual(passed);
  });

  it("rejects malformed configuration before a draft can start", () => {
    expect(() => createGenericAuctionMockState(baseConfig({ budgetDollars: 1 })))
      .toThrowError(expect.objectContaining({ code: "invalid_config" }));
    expect(() => createGenericAuctionMockState(baseConfig({
      teams: [
        { id: "team-a", name: "Cam" },
        { id: "team-a", name: "Duplicate" },
        { id: "team-c", name: "Seth" },
        { id: "team-d", name: "PJ" },
      ],
    }))).toThrowError(expect.objectContaining({ code: "invalid_config" }));
    expect(() => createGenericAuctionMockState(baseConfig({
      positionMaximums: { QB: 1, RB: 2 },
    }))).toThrowError(expect.objectContaining({ code: "invalid_config" }));
    expect(() => createGenericAuctionMockState(baseConfig({
      ai: { spendPacingExcludedPlayerIds: ["missing-player"] },
    }))).toThrowError(expect.objectContaining({ code: "invalid_config" }));
  });
});
