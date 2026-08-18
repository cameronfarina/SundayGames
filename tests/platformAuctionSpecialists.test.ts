import { describe, expect, it } from "vitest";

import {
  applyGenericAuctionMockCommand,
  createGenericAuctionMockState,
  isAutomatedAuctionAcquisitionEligible,
  type GenericAuctionMockConfig,
} from "../src/platform/genericAuctionMockEngine.js";

const config = (
  overrides: Partial<GenericAuctionMockConfig>,
): GenericAuctionMockConfig => ({
  sessionId: "specialists",
  seed: "specialists-seed",
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
    { slot: "K", count: 1, eligiblePositions: ["K"] },
    { slot: "RB", count: 1, eligiblePositions: ["RB"] },
  ],
  positionMaximums: { K: 2, RB: 2 },
  players: [
    { id: "k-1", name: "Kicker One", position: "K", expectedPrice: 1 },
    { id: "k-2", name: "Kicker Two", position: "K", expectedPrice: 1 },
    { id: "k-3", name: "Kicker Three", position: "K", expectedPrice: 1 },
    { id: "k-4", name: "Kicker Four", position: "K", expectedPrice: 1 },
    { id: "rb-1", name: "RB One", position: "RB", expectedPrice: 10 },
    { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 9 },
    { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 8 },
    { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 7 },
  ],
  ai: { defaultBidMultiplier: 1, rosterNeedDollars: 0, randomness: 0 },
  ...overrides,
});

const start = (auctionConfig: GenericAuctionMockConfig) =>
  applyGenericAuctionMockCommand(
    createGenericAuctionMockState(auctionConfig),
    { type: "start", expectedRevision: 0 },
  );

describe("auction specialists", () => {
  it("sells every kicker and defense for two dollars", () => {
    const nominated = applyGenericAuctionMockCommand(start(config({})), {
      type: "nominate",
      expectedRevision: 1,
      playerId: "k-1",
      openingBid: 1,
    });
    const passed = applyGenericAuctionMockCommand(nominated, {
      type: "pass",
      expectedRevision: nominated.session.revision,
    });

    const sale = passed.sales.find(candidate => candidate.playerId === "k-1");
    expect(sale).toBeDefined();
    expect(sale?.price).toBe(2);
  });

  it("never lets an automated team take a second kicker or defense", () => {
    const state = start(config({
      rosterSlots: [
        { slot: "K", count: 1, eligiblePositions: ["K"] },
        { slot: "RB", count: 1, eligiblePositions: ["RB"] },
        { slot: "BENCH", count: 1, eligiblePositions: ["K", "RB"] },
      ],
      positionMaximums: { K: 2, RB: 3 },
      players: [
        { id: "k-1", name: "Kicker One", position: "K", expectedPrice: 1 },
        { id: "k-2", name: "Kicker Two", position: "K", expectedPrice: 1 },
        { id: "k-3", name: "Kicker Three", position: "K", expectedPrice: 1 },
        { id: "k-4", name: "Kicker Four", position: "K", expectedPrice: 1 },
        { id: "rb-1", name: "RB One", position: "RB", expectedPrice: 10 },
        { id: "rb-2", name: "RB Two", position: "RB", expectedPrice: 9 },
        { id: "rb-3", name: "RB Three", position: "RB", expectedPrice: 8 },
        { id: "rb-4", name: "RB Four", position: "RB", expectedPrice: 7 },
        { id: "rb-5", name: "RB Five", position: "RB", expectedPrice: 6 },
        { id: "rb-6", name: "RB Six", position: "RB", expectedPrice: 5 },
        { id: "rb-7", name: "RB Seven", position: "RB", expectedPrice: 4 },
        { id: "rb-8", name: "RB Eight", position: "RB", expectedPrice: 3 },
      ],
      keepers: [{ teamId: "team-b", playerId: "k-1", price: 1 }],
    }));
    const teamB = state.teams.find(team => team.id === "team-b");
    const spareKicker = state.board.players.find(player => player.id === "k-2");

    expect(teamB).toBeDefined();
    expect(spareKicker).toBeDefined();
    if (teamB === undefined || spareKicker === undefined) return;
    expect(isAutomatedAuctionAcquisitionEligible(state, teamB, spareKicker)).toBe(false);
  });

  it("lets about half the room, not everyone, chase a backup quarterback", () => {
    const fourteenTeams = Array.from({ length: 14 }, (_, index) => ({
      id: `team-${index + 1}`,
      name: `Owner ${index + 1}`,
    }));
    const state = start(config({
      humanTeamId: "team-1",
      teams: fourteenTeams,
      rosterSlots: [
        { slot: "QB", count: 1, eligiblePositions: ["QB"] },
        { slot: "BENCH", count: 1, eligiblePositions: ["QB", "RB"] },
      ],
      positionMaximums: { QB: 2, RB: 2 },
      players: [
        ...Array.from({ length: 16 }, (_, index) => ({
          id: `qb-${index + 1}`,
          name: `QB ${index + 1}`,
          position: "QB",
          expectedPrice: Math.max(1, 10 - index),
          starterEligible: true,
        })),
        ...Array.from({ length: 16 }, (_, index) => ({
          id: `rb-${index + 1}`,
          name: `RB ${index + 1}`,
          position: "RB",
          expectedPrice: Math.max(1, 8 - index),
        })),
      ],
      keepers: fourteenTeams.map((team, index) => ({
        teamId: team.id,
        playerId: `qb-${index + 1}`,
        price: 1,
      })),
    }));
    const spareQuarterback = state.board.players.find(player => player.id === "qb-15");
    expect(spareQuarterback).toBeDefined();
    if (spareQuarterback === undefined) return;

    // Every team already has its starting QB. History says a cheap backup
    // QB is a half-the-room habit, not a universal one.
    const willing = state.teams.filter(team =>
      isAutomatedAuctionAcquisitionEligible(state, team, spareQuarterback));
    expect(willing.length).toBeGreaterThanOrEqual(3);
    expect(willing.length).toBeLessThanOrEqual(11);
  });
});
