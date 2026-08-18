import { describe, expect, it } from "vitest";

import {
  applyGenericAuctionMockCommand,
  createGenericAuctionMockState,
  isAutomatedAuctionAcquisitionEligible,
  type GenericAuctionMockConfig,
} from "../src/platform/genericAuctionMockEngine.js";

const teams = [
  { id: "team-a", name: "Owner11" },
  { id: "team-b", name: "Owner01" },
  { id: "team-c", name: "Owner04" },
  { id: "team-d", name: "Owner03" },
];

const config = (
  overrides: Partial<GenericAuctionMockConfig>,
): GenericAuctionMockConfig => ({
  sessionId: "owner-behavior",
  seed: "owner-behavior-seed",
  humanTeamId: "team-a",
  budgetDollars: 50,
  minimumBidDollars: 1,
  teams,
  rosterSlots: [
    { slot: "QB", count: 1, eligiblePositions: ["QB"] },
    { slot: "RB", count: 1, eligiblePositions: ["RB"] },
    { slot: "BENCH", count: 1, eligiblePositions: ["QB", "RB"] },
  ],
  positionMaximums: { QB: 3, RB: 3 },
  players: [],
  ai: { defaultBidMultiplier: 1, rosterNeedDollars: 0, randomness: 0 },
  ...overrides,
});

const start = (auctionConfig: GenericAuctionMockConfig) =>
  applyGenericAuctionMockCommand(
    createGenericAuctionMockState(auctionConfig),
    { type: "start", expectedRevision: 0 },
  );

describe("auction owner behavior", () => {
  it("nominates the most valuable player, not a cheap starter-slot specialist", () => {
    const state = start(config({
      humanTeamId: "team-d",
      players: [
        { id: "star-rb", name: "Star RB", position: "RB", expectedPrice: 40 },
        { id: "qb-1", name: "QB One", position: "QB", expectedPrice: 8, starterEligible: true },
        { id: "qb-2", name: "QB Two", position: "QB", expectedPrice: 6, starterEligible: true },
        { id: "qb-3", name: "QB Three", position: "QB", expectedPrice: 5, starterEligible: true },
        { id: "qb-4", name: "QB Four", position: "QB", expectedPrice: 4, starterEligible: true },
        { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 12 },
        { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 10 },
        { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 9 },
        { id: "rb-5", name: "RB Five", position: "RB", expectedPrice: 8 },
        { id: "rb-6", name: "RB Six", position: "RB", expectedPrice: 7 },
        { id: "rb-7", name: "RB Seven", position: "RB", expectedPrice: 6 },
        { id: "rb-8", name: "RB Eight", position: "RB", expectedPrice: 5 },
      ],
    }));

    expect(state.session.currentNomination?.playerId).toBe("star-rb");
  });

  it("pays a few dollars at most for a backup specialist", () => {
    const auctionConfig = config({
      players: [
        { id: "qb-starter-b", name: "Kept QB B", position: "QB", expectedPrice: 10 },
        { id: "qb-starter-c", name: "Kept QB C", position: "QB", expectedPrice: 10 },
        { id: "qb-starter-d", name: "Kept QB D", position: "QB", expectedPrice: 10 },
        { id: "qb-backup", name: "Backup QB", position: "QB", expectedPrice: 10 },
        { id: "qb-extra", name: "Extra QB", position: "QB", expectedPrice: 9 },
        { id: "rb-1", name: "RB One", position: "RB", expectedPrice: 8 },
        { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 7 },
        { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 6 },
        { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 5 },
        { id: "rb-5", name: "RB Five", position: "RB", expectedPrice: 4 },
        { id: "rb-6", name: "RB Six", position: "RB", expectedPrice: 3 },
        { id: "qb-human", name: "Human QB", position: "QB", expectedPrice: 2 },
      ],
      keepers: [
        { teamId: "team-b", playerId: "qb-starter-b", price: 10 },
        { teamId: "team-c", playerId: "qb-starter-c", price: 10 },
        { teamId: "team-d", playerId: "qb-starter-d", price: 10 },
      ],
    });
    const nominated = applyGenericAuctionMockCommand(start(auctionConfig), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "qb-backup",
      openingBid: 1,
    });
    const passed = applyGenericAuctionMockCommand(nominated, {
      type: "pass",
      expectedRevision: nominated.session.revision,
    });

    const sale = passed.sales.find(candidate => candidate.playerId === "qb-backup");
    expect(sale).toBeDefined();
    expect(sale?.price).toBeLessThanOrEqual(3);
  });

  it("refuses a second backup specialist while runners or receivers remain", () => {
    const state = createGenericAuctionMockState(config({
      players: [
        { id: "qb-starter-b", name: "Kept QB B", position: "QB", expectedPrice: 10, starterEligible: true },
        { id: "qb-backup-b", name: "Kept Backup B", position: "QB", expectedPrice: 5, starterEligible: true },
        { id: "qb-third", name: "Third QB", position: "QB", expectedPrice: 5, starterEligible: true },
        { id: "rb-1", name: "RB One", position: "RB", expectedPrice: 8 },
        { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 7 },
        { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 6 },
        { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 5 },
        { id: "rb-5", name: "RB Five", position: "RB", expectedPrice: 4 },
        { id: "rb-6", name: "RB Six", position: "RB", expectedPrice: 3 },
        { id: "rb-7", name: "RB Seven", position: "RB", expectedPrice: 3 },
        { id: "qb-c", name: "QB C", position: "QB", expectedPrice: 4, starterEligible: true },
        { id: "qb-d", name: "QB D", position: "QB", expectedPrice: 3, starterEligible: true },
        { id: "qb-human", name: "Human QB", position: "QB", expectedPrice: 2, starterEligible: true },
      ],
      keepers: [
        { teamId: "team-b", playerId: "qb-starter-b", price: 10 },
        { teamId: "team-b", playerId: "qb-backup-b", price: 5 },
      ],
    }));
    const teamB = state.teams.find(team => team.id === "team-b");
    const thirdQb = state.board.players.find(player => player.id === "qb-third");

    expect(teamB).toBeDefined();
    expect(thirdQb).toBeDefined();
    if (teamB === undefined || thirdQb === undefined) return;
    expect(isAutomatedAuctionAcquisitionEligible(state, teamB, thirdQb)).toBe(false);
  });

  it("spends keeper surplus on starters, never on bench fill", () => {
    const auctionConfig = config({
      rosterSlots: [
        { slot: "RB", count: 1, eligiblePositions: ["RB"] },
        { slot: "BENCH", count: 1, eligiblePositions: ["RB"] },
      ],
      positionMaximums: { RB: 2 },
      players: [
        { id: "kept-bargain", name: "Kept Bargain", position: "RB", expectedPrice: 30 },
        { id: "bench-rb", name: "Bench RB", position: "RB", expectedPrice: 5 },
        { id: "rb-1", name: "RB One", position: "RB", expectedPrice: 8 },
        { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 7 },
        { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 6 },
        { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 5 },
        { id: "rb-5", name: "RB Five", position: "RB", expectedPrice: 4 },
        { id: "rb-6", name: "RB Six", position: "RB", expectedPrice: 4 },
      ],
      keepers: [{ teamId: "team-b", playerId: "kept-bargain", price: 5 }],
    });
    const nominated = applyGenericAuctionMockCommand(start(auctionConfig), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "bench-rb",
      openingBid: 1,
    });
    const passed = applyGenericAuctionMockCommand(nominated, {
      type: "pass",
      expectedRevision: nominated.session.revision,
    });

    // Team B holds a $25 keeper surplus, but its only open slot is a bench
    // slot, so it never bids that surplus onto a $5 bench player.
    const sale = passed.sales.find(candidate => candidate.playerId === "bench-rb");
    expect(sale).toBeDefined();
    expect(sale?.price).toBeLessThanOrEqual(6);
  });

  it("pays up for a starter when it holds more cash than the room", () => {
    const auctionConfig = config({
      rosterSlots: [
        { slot: "RB", count: 1, eligiblePositions: ["RB"] },
        { slot: "BENCH", count: 1, eligiblePositions: ["RB"] },
      ],
      positionMaximums: { RB: 2 },
      players: [
        { id: "kept-a", name: "Kept A", position: "RB", expectedPrice: 30 },
        { id: "kept-c", name: "Kept C", position: "RB", expectedPrice: 30 },
        { id: "kept-d", name: "Kept D", position: "RB", expectedPrice: 30 },
        { id: "starter-rb", name: "Starter RB", position: "RB", expectedPrice: 20 },
        { id: "rb-1", name: "RB One", position: "RB", expectedPrice: 6 },
        { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 5 },
        { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 4 },
        { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 4 },
        { id: "rb-5", name: "RB Five", position: "RB", expectedPrice: 3 },
      ],
      keepers: [
        { teamId: "team-a", playerId: "kept-a", price: 30 },
        { teamId: "team-c", playerId: "kept-c", price: 30 },
        { teamId: "team-d", playerId: "kept-d", price: 30 },
      ],
    });
    const nominated = applyGenericAuctionMockCommand(start(auctionConfig), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "starter-rb",
      openingBid: 1,
    });
    const passed = applyGenericAuctionMockCommand(nominated, {
      type: "pass",
      expectedRevision: nominated.session.revision,
    });

    // Team B never kept anyone, so it holds the most spare cash and beats
    // the market-value bids from the poorer teams by a few dollars.
    const sale = passed.sales.find(candidate => candidate.playerId === "starter-rb");
    expect(sale).toBeDefined();
    expect(sale?.teamId).toBe("team-b");
    expect(sale?.price).toBeGreaterThan(20);
  });

  it("opens a final-slot nomination at the minimum bid instead of dumping budget", () => {
    const state = start(config({
      humanTeamId: "team-d",
      rosterSlots: [{ slot: "RB", count: 1, eligiblePositions: ["RB"] }],
      positionMaximums: { RB: 1 },
      players: [
        { id: "rb-1", name: "RB One", position: "RB", expectedPrice: 3 },
        { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 2 },
        { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 2 },
        { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 1 },
      ],
    }));

    // The AI nominator has its whole $50 and one roster slot, yet the bid
    // starts at $1 and settles near value.
    const nomination = state.session.currentNomination;
    expect(nomination).toBeDefined();
    expect(nomination?.currentPrice).toBeLessThanOrEqual(4);
  });
});
