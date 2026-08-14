import { describe, expect, it } from "vitest";

import {
  createGenericAuctionMockState,
  type GenericAuctionMockConfig,
} from "../src/platform/genericAuctionMockEngine.js";
import {
  auctionRosterNeedFor,
  canAuctionTeamAcquire,
  canAuctionTeamRoster,
  needsDedicatedStarterFor,
  plannedFutureTargetsFor,
  preservesSlotsForTargets,
} from "../src/platform/seasonSimulationEngine/auctionTargets.js";
import type { SeasonSimulationTargetConstraint } from
  "../src/platform/seasonSimulationTargets.js";

const stateFor = () => createGenericAuctionMockState({
  sessionId: "target-needs",
  seed: "target-needs-seed",
  humanTeamId: "human",
  budgetDollars: 20,
  minimumBidDollars: 1,
  teams: [
    { id: "human", name: "Human" },
    { id: "two", name: "Two" },
    { id: "three", name: "Three" },
    { id: "four", name: "Four" },
  ],
  rosterSlots: [
    { slot: "QB", count: 1, eligiblePositions: ["QB"] },
    { slot: "RB", count: 1, eligiblePositions: ["RB"] },
    { slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR"] },
  ],
  positionMaximums: { QB: 1, RB: 2, WR: 1 },
  players: [
    ...playersFor("QB", 4),
    ...playersFor("RB", 4),
    ...playersFor("WR", 4),
  ],
} satisfies GenericAuctionMockConfig);

const playersFor = (position: string, count: number) => Array.from(
  { length: count },
  (_, index) => ({
    id: `${position.toLowerCase()}-${index + 1}`,
    name: `${position} Player ${index + 1}`,
    position,
    expectedPrice: 5 - index,
  }),
);

describe("season simulation auction target roster needs", () => {
  it("measures dedicated and flexible needs and rejects unavailable or ineligible players", () => {
    const state = stateFor();
    const team = state.teams.find(candidate => candidate.id === "human");
    const runningBack = state.board.players.find(player => player.id === "rb-1");
    if (team === undefined || runningBack === undefined) throw new Error("Missing fixture data.");

    expect(auctionRosterNeedFor(team, "RB")).toBe(1.5);
    expect(needsDedicatedStarterFor(team, "QB")).toBe(true);
    expect(needsDedicatedStarterFor(team, "WR")).toBe(false);
    expect(canAuctionTeamRoster(state, team, runningBack)).toBe(true);
    expect(canAuctionTeamAcquire(state, team, { ...runningBack, available: false })).toBe(false);
    expect(canAuctionTeamRoster(state, team, { ...runningBack, position: "TE" })).toBe(false);
    expect(preservesSlotsForTargets(
      state,
      team,
      { ...runningBack, position: "TE" },
      [],
    )).toBe(false);
  });

  it("preserves a constrained target and plans around a current target", () => {
    const state = stateFor();
    const team = state.teams.find(candidate => candidate.id === "human");
    const runningBack = state.board.players.find(player => player.id === "rb-1");
    const receiver = state.board.players.find(player => player.id === "wr-1");
    if (team === undefined || runningBack === undefined || receiver === undefined) {
      throw new Error("Missing fixture data.");
    }
    const targets = new Map<string, SeasonSimulationTargetConstraint>([
      [runningBack.id, { playerName: runningBack.name }],
      [receiver.id, { playerName: receiver.name }],
    ]);

    expect(preservesSlotsForTargets(state, team, runningBack, [receiver])).toBe(true);
    expect(plannedFutureTargetsFor(state, team, runningBack, targets).map(player => player.id))
      .toEqual(["wr-1"]);
  });
});
