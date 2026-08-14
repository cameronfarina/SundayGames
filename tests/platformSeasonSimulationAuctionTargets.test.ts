import { describe, expect, it } from "vitest";

import {
  createGenericAuctionMockState,
  type GenericAuctionMockConfig,
  type GenericAuctionMockState,
} from "../src/platform/genericAuctionMockEngine.js";
import type { ParsedSeasonSimulationStrategy } from
  "../src/platform/seasonSimulationEngine/contracts.js";
import {
  auctionProjectedWeeklyProductionFor,
  canAuctionTeamAcquire,
  minimumTargetAcquisitionCostFor,
  plannedFutureTargetsFor,
  preservesSlotsForTargets,
  targetsFor,
} from "../src/platform/seasonSimulationEngine/auctionTargets.js";
import type { SeasonSimulationTargetConstraint } from
  "../src/platform/seasonSimulationTargets.js";
import { canFitTargetPositions } from
  "../src/platform/seasonSimulationEngine/auctionTargets/slotMatching.js";
import { canReserveTargetsForTeam } from
  "../src/platform/seasonSimulationEngine/auctionTargets/slotReservations.js";

const configFor = (budgetDollars = 20): GenericAuctionMockConfig => ({
  sessionId: "target-policy",
  seed: "target-policy-seed",
  humanTeamId: "human",
  budgetDollars,
  minimumBidDollars: 1,
  teams: [
    { id: "human", name: "Human" },
    { id: "two", name: "Two" },
    { id: "three", name: "Three" },
    { id: "four", name: "Four" },
  ],
  rosterSlots: [
    { slot: "RB", count: 1, eligiblePositions: ["RB"] },
    { slot: "WR", count: 1, eligiblePositions: ["WR"] },
    { slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR"] },
  ],
  positionMaximums: { RB: 2, WR: 2 },
  players: [
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `rb-${index + 1}`,
      name: `Running Back ${index + 1}`,
      position: "RB",
      expectedPrice: index === 0 ? 8 : 3,
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `wr-${index + 1}`,
      name: `Wide Receiver ${index + 1}`,
      position: "WR",
      expectedPrice: index === 0 ? 7 : 2,
    })),
  ],
});

const stateAndHumanTeam = (budgetDollars = 20) => {
  const state = createGenericAuctionMockState(configFor(budgetDollars));
  const team = state.teams.find(candidate => candidate.id === "human");
  if (team === undefined) throw new Error("Expected the human auction team.");
  return { state, team };
};

const playerFor = (state: GenericAuctionMockState, id: string) => {
  const player = state.board.players.find(candidate => candidate.id === id);
  if (player === undefined) throw new Error(`Expected auction player ${id}.`);
  return player;
};

describe("season simulation auction target policy", () => {
  it("normalizes current and legacy target strategy shapes without changing order", () => {
    const first = { playerName: "Running Back 1" };
    const second = { playerName: "Wide Receiver 1", maxAuctionPrice: 6 };
    const strategy: ParsedSeasonSimulationStrategy = {
      rawInput: "draft targets",
      targets: [first, second],
      target: { playerName: "Legacy" },
      preferredPositions: [],
      summary: "Target two players.",
      warnings: [],
    };

    expect(targetsFor(strategy)).toEqual([first, second]);
    expect(targetsFor({ ...strategy, targets: undefined })).toEqual([strategy.target]);
    expect(targetsFor({ ...strategy, targets: undefined, target: undefined })).toEqual([]);
  });

  it("uses weekly, four-week, then season projection fallbacks", () => {
    const { state } = stateAndHumanTeam();
    const player = playerFor(state, "rb-1");

    expect(auctionProjectedWeeklyProductionFor({ ...player, week1Projection: 12 })).toBe(12);
    expect(auctionProjectedWeeklyProductionFor({ ...player, weeks1To4Projection: 36 })).toBe(9);
    expect(auctionProjectedWeeklyProductionFor({ ...player, seasonProjection: 170 })).toBe(10);
    expect(auctionProjectedWeeklyProductionFor(player)).toBe(0);
  });

  it("reserves affordable targets while preserving compatible roster slots", () => {
    const { state, team } = stateAndHumanTeam(15);
    const candidate = playerFor(state, "rb-2");
    const runningBack = playerFor(state, "rb-1");
    const receiver = playerFor(state, "wr-1");
    const otherRunningBack = playerFor(state, "rb-3");
    const runningBackTarget: SeasonSimulationTargetConstraint = {
      playerName: runningBack.name,
      maxAuctionPrice: 5,
    };
    const receiverTarget: SeasonSimulationTargetConstraint = { playerName: receiver.name };
    const targets = new Map([
      [runningBack.id, runningBackTarget],
      [receiver.id, receiverTarget],
    ]);

    expect(canAuctionTeamAcquire(state, team, candidate)).toBe(true);
    expect(minimumTargetAcquisitionCostFor(state, runningBack, targets)).toBe(5);
    expect(plannedFutureTargetsFor(state, team, candidate, targets).map(player => player.id))
      .toEqual(["rb-1", "wr-1"]);
    expect(preservesSlotsForTargets(state, team, candidate, [runningBack, otherRunningBack]))
      .toBe(false);
  });

  it("rejects impossible target slots, position totals, and unaffordable later targets", () => {
    const { state, team } = stateAndHumanTeam(10);
    const candidate = playerFor(state, "rb-2");
    const runningBack = playerFor(state, "rb-1");
    const otherRunningBack = playerFor(state, "rb-3");
    const receiver = playerFor(state, "wr-1");
    const targets = new Map<string, SeasonSimulationTargetConstraint>([
      [runningBack.id, { playerName: runningBack.name, maxAuctionPrice: 5 }],
      [receiver.id, { playerName: receiver.name }],
    ]);

    expect(canFitTargetPositions(["RB", "RB", "RB"], team.slots)).toBe(false);
    expect(canReserveTargetsForTeam(state, team, [
      runningBack,
      candidate,
      otherRunningBack,
    ])).toBe(false);
    expect(plannedFutureTargetsFor(state, team, candidate, targets).map(player => player.id))
      .toEqual(["rb-1"]);
  });
});
