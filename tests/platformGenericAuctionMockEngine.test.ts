import { describe, expect, it } from "vitest";

import {
  applyGenericAuctionMockCommand,
  createGenericAuctionMockState,
  maximumAutomatedAuctionBidFor,
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
    { id: "team-a", name: "Owner11" },
    { id: "team-b", name: "Owner01" },
    { id: "team-c", name: "Owner04" },
    { id: "team-d", name: "Owner03" },
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
      name: "Owner11",
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
        currentPrice: 16,
        nextBid: 17,
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
        price: 16,
      }),
    ]));
  });

  it("never shows an AI owner outbidding itself in the reconstructed bid feed", () => {
    const config = baseConfig({
      budgetDollars: 100,
      teams: [
        { id: "team-a", name: "Owner11" },
        { id: "team-b", name: "Owner01", aiTendency: { bidMultiplier: 1.5 } },
        { id: "team-c", name: "Owner04", aiTendency: { bidMultiplier: 1.44 } },
        { id: "team-d", name: "Owner03", aiTendency: { bidMultiplier: 1.4 } },
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
      price: 17,
    });

    expect(bought.sales[0]).toMatchObject({
      number: 1,
      playerId: "qb-1",
      teamId: "team-a",
      price: 17,
      source: "human",
      nominatedByTeamId: "team-a",
    });
    expect(bought.teams.find(team => team.id === "team-a")).toMatchObject({
      spent: 17,
      budgetRemaining: 3,
      rosterSlotsRemaining: 1,
      maxBid: 3,
    });
    expect(bought.teams.find(team => team.id === "team-a")?.roster[0])
      .toMatchObject({ playerId: "qb-1", rosterSlot: "QB", price: 17 });
    expect(bought.board.players.find(player => player.id === "qb-1"))
      .toMatchObject({ status: "sold", available: false });
    expect(bought.session.phase).toBe("awaiting_human_nomination");
    expect(bought.session.currentNomination).toBeUndefined();
  });

  it("automatically counters a human bid when an AI ceiling is higher", () => {
    const config = baseConfig({
      teams: [
        { id: "team-a", name: "Owner11" },
        {
          id: "team-b",
          name: "WR Collector",
          aiTendency: { positionBidMultipliers: { WR: 2 } },
        },
        { id: "team-c", name: "Owner04" },
        { id: "team-d", name: "Owner03" },
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
      price: 14,
    });

    expect(countered.sales).toEqual([]);
    expect(countered.session.currentNomination).toMatchObject({
      highestBidderTeamId: "team-b",
      currentPrice: 15,
      nextBid: 16,
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
      price: 16,
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
        price: 16,
      }),
    ]));
  });

  it("raises AI ceilings as a position becomes depleted", () => {
    const teams = [
      { id: "team-a", name: "Owner11" },
      { id: "team-b", name: "Owner01" },
      { id: "team-c", name: "Owner04" },
      { id: "team-d", name: "Owner03" },
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
      },
    });
    const nominated = applyGenericAuctionMockCommand(start(config), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "target",
      openingBid: 1,
    });
    const passed = applyGenericAuctionMockCommand(nominated, {
      type: "pass",
      expectedRevision: nominated.session.revision,
    });

    expect(passed.sales.find(sale => sale.playerId === "target"))
      .toMatchObject({ teamId: "team-b" });
    expect(passed.sales.find(sale => sale.playerId === "target")?.price).toBeGreaterThan(40);
  });

  it("never spends a budget down onto a kicker or a defense", () => {
    const config = baseConfig({
      budgetDollars: 60,
      rosterSlots: [
        { slot: "RB", count: 1, eligiblePositions: ["RB"] },
        { slot: "K", count: 1, eligiblePositions: ["K"] },
        { slot: "DST", count: 1, eligiblePositions: ["DST"] },
      ],
      positionMaximums: { RB: 1, K: 1, DST: 1 },
      players: [
        { id: "rb-1", name: "RB One", position: "RB", expectedPrice: 40 },
        { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 35 },
        { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 30 },
        { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 25 },
        { id: "k-1", name: "Kicker One", position: "K", expectedPrice: 1 },
        { id: "k-2", name: "Kicker Two", position: "K", expectedPrice: 1 },
        { id: "k-3", name: "Kicker Three", position: "K", expectedPrice: 1 },
        { id: "k-4", name: "Kicker Four", position: "K", expectedPrice: 1 },
        { id: "dst-1", name: "Defense One", position: "DST", expectedPrice: 1 },
        { id: "dst-2", name: "Defense Two", position: "DST", expectedPrice: 1 },
        { id: "dst-3", name: "Defense Three", position: "DST", expectedPrice: 1 },
        { id: "dst-4", name: "Defense Four", position: "DST", expectedPrice: 1 },
      ],
      ai: {
        defaultBidMultiplier: 1,
        rosterNeedDollars: 0,
        randomness: 0,
      },
    });
    const nominated = applyGenericAuctionMockCommand(start(config), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "k-1",
      openingBid: 1,
    });
    const passed = applyGenericAuctionMockCommand(nominated, {
      type: "pass",
      expectedRevision: 2,
    });

    expect(passed.sales.find(sale => sale.playerId === "k-1")?.price).toBe(1);
  });

  it("uses owner tendencies to produce deterministic AI bidding personalities", () => {
    const config = baseConfig({
      teams: [
        { id: "team-a", name: "Owner11" },
        {
          id: "team-b",
          name: "WR Collector",
          aiTendency: { positionBidMultipliers: { WR: 2 } },
        },
        { id: "team-c", name: "Owner04" },
        { id: "team-d", name: "Owner03" },
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
      currentPrice: 13,
    });
    expect(passed.sales[0]).toMatchObject({ teamId: "team-b", playerId: "wr-1", price: 13 });
  });

  it("centers competitive AI clearing prices around the expected market price", () => {
    const teams = Array.from({ length: 14 }, (_, index) => ({
      id: `team-${index + 1}`,
      name: index === 0 ? "Owner11" : `Opponent ${index}`,
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
        { id: "team-a", name: "Owner11" },
        { id: "team-c", name: "Owner04" },
        { id: "team-b", name: "Owner01" },
        { id: "team-d", name: "Owner03" },
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
      currentPrice: 14,
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

  it("fails explicitly instead of filling a required starter slot with a zero projection", () => {
    const config = baseConfig({
      rosterSlots: [{ slot: "QB", count: 1, eligiblePositions: ["QB"] }],
      positionMaximums: { QB: 1 },
      players: [
        {
          id: "kept-starter",
          name: "Kept Starter",
          position: "QB",
          expectedPrice: 10,
          week1Projection: 20,
          starterEligible: true,
        },
        {
          id: "starter-2",
          name: "Starter Two",
          position: "QB",
          expectedPrice: 8,
          week1Projection: 18,
          starterEligible: true,
        },
        {
          id: "starter-3",
          name: "Starter Three",
          position: "QB",
          expectedPrice: 7,
          week1Projection: 17,
          starterEligible: true,
        },
        {
          id: "zero-backup",
          name: "Zero Backup",
          position: "QB",
          expectedPrice: 1,
          week1Projection: 0,
          starterEligible: false,
        },
      ],
      keepers: [{ teamId: "team-a", playerId: "kept-starter", price: 1 }],
    });

    expect(() => start(config)).toThrowError(expect.objectContaining({
      code: "no_eligible_player",
    }));
  });

  it("uses the best positive projection when the starter-eligible pool is exhausted", () => {
    const config = baseConfig({
      rosterSlots: [{ slot: "QB", count: 1, eligiblePositions: ["QB"] }],
      positionMaximums: { QB: 1 },
      players: [
        {
          id: "kept-starter",
          name: "Kept Starter",
          position: "QB",
          expectedPrice: 10,
          week1Projection: 20,
          starterEligible: true,
        },
        {
          id: "starter-2",
          name: "Starter Two",
          position: "QB",
          expectedPrice: 8,
          week1Projection: 18,
          starterEligible: true,
        },
        {
          id: "starter-3",
          name: "Starter Three",
          position: "QB",
          expectedPrice: 7,
          week1Projection: 17,
          starterEligible: true,
        },
        {
          id: "positive-fallback",
          name: "Positive Fallback",
          position: "QB",
          expectedPrice: 1,
          week1Projection: 2,
          starterEligible: false,
        },
        {
          id: "zero-backup",
          name: "Zero Backup",
          position: "QB",
          expectedPrice: 1,
          week1Projection: 0,
          starterEligible: false,
        },
      ],
      keepers: [{ teamId: "team-a", playerId: "kept-starter", price: 1 }],
    });

    const ready = start(config);

    expect(ready.session.phase).toBe("ready_to_complete");
    expect(ready.teams.every(team => team.rosterSlotsRemaining === 0)).toBe(true);
    expect(ready.sales.find(sale => sale.playerId === "positive-fallback"))
      .toMatchObject({ source: "ai" });
    expect(ready.board.players.find(player => player.id === "zero-backup"))
      .toMatchObject({ status: "available" });
  });

  it("keeps ineligible specialist keepers on the bench and leaves RB/WR depth draftable", () => {
    const config = baseConfig({
      rosterSlots: [
        { slot: "QB", count: 1, eligiblePositions: ["QB"] },
        { slot: "BENCH", count: 1, eligiblePositions: ["QB", "RB", "WR"] },
      ],
      positionMaximums: { QB: 2, RB: 1, WR: 1 },
      players: [
        {
          id: "kept-backup",
          name: "Kept Backup",
          position: "QB",
          expectedPrice: 1,
          week1Projection: 0.5,
          starterEligible: false,
        },
        ...Array.from({ length: 4 }, (_, index) => ({
          id: `starter-${index + 1}`,
          name: `Starter ${index + 1}`,
          position: "QB",
          expectedPrice: 10 - index,
          week1Projection: 20 - index,
          starterEligible: true,
        })),
        {
          id: "backup-depth",
          name: "Backup Depth",
          position: "QB",
          expectedPrice: 1,
          week1Projection: 0.4,
          starterEligible: false,
        },
        ...Array.from({ length: 4 }, (_, index) => ({
          id: `rb-${index + 1}`,
          name: `RB ${index + 1}`,
          position: "RB",
          expectedPrice: 4 - index,
          week1Projection: 8 - index,
        })),
        ...Array.from({ length: 4 }, (_, index) => ({
          id: `wr-${index + 1}`,
          name: `WR ${index + 1}`,
          position: "WR",
          expectedPrice: 4 - index,
          week1Projection: 8 - index,
        })),
      ],
      keepers: [
        { teamId: "team-a", playerId: "kept-backup", price: 1 },
        { teamId: "team-a", playerId: "starter-1", price: 1 },
      ],
    });

    const ready = start(config);
    const humanRoster = ready.teams.find(team => team.id === "team-a")?.roster;
    const aiRosters = ready.teams.filter(team => !team.isHuman).map(team => team.roster);

    expect(humanRoster?.find(player => player.playerId === "kept-backup"))
      .toMatchObject({ source: "keeper", rosterSlot: "BENCH" });
    expect(humanRoster?.find(player => player.playerId === "starter-1"))
      .toMatchObject({ source: "keeper", rosterSlot: "QB" });
    expect(aiRosters.every(roster => roster.some(player =>
      player.rosterSlot === "QB" && player.playerId.startsWith("starter-")
    ))).toBe(true);
    expect(aiRosters.every(roster => roster.some(player =>
      player.rosterSlot === "BENCH" && (player.position === "RB" || player.position === "WR")
    ))).toBe(true);
    expect(ready.teams.every(team => team.rosterSlotsRemaining === 0)).toBe(true);
    expect(ready.board.players.find(player => player.id === "backup-depth"))
      .toMatchObject({ status: "available" });
  });

  it("reserves the minimum bid for a positive fallback after starter eligibility is exhausted", () => {
    const setup = createGenericAuctionMockState(baseConfig({
      budgetDollars: 20,
      minimumBidDollars: 2,
      rosterSlots: [
        { slot: "RB", count: 1, eligiblePositions: ["RB"] },
        { slot: "QB", count: 1, eligiblePositions: ["QB"] },
      ],
      positionMaximums: { RB: 1, QB: 1 },
      players: [
        {
          id: "target-rb",
          name: "Target RB",
          position: "RB",
          expectedPrice: 20,
          week1Projection: 12,
        },
        {
          id: "positive-fallback",
          name: "Positive Fallback",
          position: "QB",
          expectedPrice: 1,
          week1Projection: 2,
          starterEligible: false,
        },
        {
          id: "zero-backup",
          name: "Zero Backup",
          position: "QB",
          expectedPrice: 1,
          week1Projection: 0,
          starterEligible: false,
        },
        {
          id: "zero-backup-two",
          name: "Zero Backup Two",
          position: "QB",
          expectedPrice: 1,
          week1Projection: 0,
          starterEligible: false,
        },
        {
          id: "zero-backup-three",
          name: "Zero Backup Three",
          position: "QB",
          expectedPrice: 1,
          week1Projection: 0,
          starterEligible: false,
        },
        ...Array.from({ length: 5 }, (_, index) => ({
          id: `depth-rb-${index + 1}`,
          name: `Depth RB ${index + 1}`,
          position: "RB",
          expectedPrice: 1,
          week1Projection: 5,
        })),
      ],
    }));
    const team = setup.teams.find(candidate => candidate.id === "team-b");
    const target = setup.board.players.find(player => player.id === "target-rb");

    expect(team).toBeDefined();
    expect(target).toBeDefined();
    if (team === undefined || target === undefined) return;

    expect(maximumAutomatedAuctionBidFor(setup, team, target)).toBe(18);
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
        { id: "team-a", name: "Owner11" },
        { id: "team-a", name: "Duplicate" },
        { id: "team-c", name: "Owner04" },
        { id: "team-d", name: "Owner03" },
      ],
    }))).toThrowError(expect.objectContaining({ code: "invalid_config" }));
    expect(() => createGenericAuctionMockState(baseConfig({
      positionMaximums: { QB: 1, RB: 2 },
    }))).toThrowError(expect.objectContaining({ code: "invalid_config" }));
  });
});
