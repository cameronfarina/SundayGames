import { describe, expect, it } from "vitest";
import {
  applyGenericAuctionMockCommand,
  createGenericAuctionMockState,
  type GenericAuctionMockCommand,
  type GenericAuctionMockConfig,
  type GenericAuctionMockState,
} from "../src/platform/genericAuctionMockEngine.js";
import { buildSeasonMockResults } from "../src/platform/seasonMockResults.js";
import {
  applySnakeDraftCommand,
  createSnakeDraftState,
  type SnakeDraftCommand,
  type SnakeDraftConfig,
  type SnakeDraftState,
} from "../src/platform/snakeDraftEngine.js";

const teamConfigs = ["Owner11", "Owner12", "Matt", "Nick"].map((name, index) => ({
  id: `team-${index + 1}`,
  name,
}));

const completeAuction = (config: GenericAuctionMockConfig): GenericAuctionMockState => {
  let state = createGenericAuctionMockState(config);
  let command: GenericAuctionMockCommand = { type: "start", expectedRevision: 0 };

  for (let step = 0; step < 100; step += 1) {
    state = applyGenericAuctionMockCommand(state, command);
    if (state.session.phase === "ready_to_complete") {
      return applyGenericAuctionMockCommand(state, {
        type: "complete",
        expectedRevision: state.session.revision,
      });
    }
    command = state.session.phase === "awaiting_human_nomination"
      ? {
          type: "nominate",
          expectedRevision: state.session.revision,
          playerId: state.board.players.find(player => player.available)?.id ?? "",
        }
      : { type: "pass", expectedRevision: state.session.revision };
  }

  throw new Error("Auction mock did not complete.");
};

const completeSnake = (config: SnakeDraftConfig): SnakeDraftState => {
  let state = createSnakeDraftState(config);
  let command: SnakeDraftCommand = { type: "start", expectedRevision: 0 };

  for (let step = 0; step < 100; step += 1) {
    state = applySnakeDraftCommand(state, command);
    if (state.session.canComplete) {
      return applySnakeDraftCommand(state, {
        type: "complete",
        expectedRevision: state.session.revision,
      });
    }
    command = {
      type: "pick",
      expectedRevision: state.session.revision,
      playerId: state.board.players.find(player => player.available)?.id ?? "",
    };
  }

  throw new Error("Snake mock did not complete.");
};

describe("season mock results", () => {
  it("ranks every auction team by its best projected Week 1 lineup", () => {
    const state = completeAuction({
      sessionId: "auction-results",
      seed: "auction-results-seed",
      humanTeamId: "team-1",
      budgetDollars: 30,
      minimumBidDollars: 1,
      teams: teamConfigs,
      rosterSlots: [
        { slot: "UTILITY", count: 2, eligiblePositions: ["RB", "WR"] },
        { slot: "BENCH", count: 1, eligiblePositions: ["RB", "WR"] },
      ],
      positionMaximums: { RB: 3, WR: 3 },
      players: Array.from({ length: 12 }, (_, index) => ({
        id: `auction-player-${index + 1}`,
        name: `Auction Player ${index + 1}`,
        position: index % 2 === 0 ? "RB" : "WR",
        expectedPrice: Math.max(1, 12 - index),
        week1Projection: index + 1,
      })),
      ai: { randomness: 0, rosterNeedDollars: 0 },
    });

    const results = buildSeasonMockResults(state);

    expect(results.teams).toHaveLength(4);
    expect(results.teams.map(team => team.rank)).toEqual([1, 2, 3, 4]);
    expect(results.teams.every(team => team.roster.length === 3)).toBe(true);
    expect(results.teams.every(team => team.roster.filter(player => player.starter).length === 2)).toBe(true);
    expect(results.teams[0]?.week1Points).toBeGreaterThanOrEqual(results.teams[1]?.week1Points ?? 0);
    expect(results.teams.flatMap(team => team.roster).every(player => player.week1Points > 0)).toBe(true);
  });

  it("builds the same all-team Week 1 comparison for snake mocks", () => {
    const state = completeSnake({
      sessionId: "snake-results",
      seed: "snake-results-seed",
      rounds: 2,
      orderType: "standard",
      teamOrder: teamConfigs.map(team => team.id),
      humanTeamId: "team-1",
      teams: teamConfigs,
      rosterSlots: [{ slot: "UTILITY", count: 2, eligiblePositions: ["RB", "WR"] }],
      players: Array.from({ length: 8 }, (_, index) => ({
        id: `snake-player-${index + 1}`,
        name: `Snake Player ${index + 1}`,
        position: index % 2 === 0 ? "RB" : "WR",
        rank: index + 1,
        adp: index + 1,
        week1Projection: 20 - index,
      })),
    });

    const results = buildSeasonMockResults(state);

    expect(results.teams).toHaveLength(4);
    expect(results.teams.every(team => team.roster.length === 2)).toBe(true);
    expect(results.teams.every(team => team.roster.every(player => player.starter))).toBe(true);
    expect(results.teams.find(team => team.isUserTeam)?.teamId).toBe("team-1");
    expect(results.teams.flatMap(team => team.roster).every(player => player.source !== "keeper")).toBe(true);
    expect(results.teams.flatMap(team => team.roster).map(player => player.overallPick).sort((left, right) =>
      (left ?? 0) - (right ?? 0)
    )).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
