import { describe, expect, it } from "vitest";

import {
  applySnakeDraftCommand,
  createSnakeDraftState,
  replaySnakeDraft,
  type SnakeDraftConfig,
} from "../src/platform/snakeDraftEngine.js";

const baseConfig = (overrides: Partial<SnakeDraftConfig> = {}): SnakeDraftConfig => ({
  sessionId: "snake-session",
  seed: "deterministic-seed",
  rounds: 2,
  orderType: "standard",
  teamOrder: ["team-a", "team-b", "team-c", "team-d"],
  humanTeamId: "team-c",
  teams: [
    { id: "team-a", name: "Alpha" },
    { id: "team-b", name: "Bravo" },
    { id: "team-c", name: "Charlie" },
    { id: "team-d", name: "Delta" },
  ],
  rosterSlots: [
    { slot: "QB", count: 1, eligiblePositions: ["QB"] },
    { slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR"] },
  ],
  players: [
    { id: "qb-1", name: "QB One", position: "QB", rank: 1, adp: 1 },
    { id: "rb-1", name: "RB One", position: "RB", rank: 2, adp: 2 },
    { id: "wr-1", name: "WR One", position: "WR", rank: 3, adp: 3 },
    { id: "qb-2", name: "QB Two", position: "QB", rank: 4, adp: 4 },
    { id: "rb-2", name: "RB Two", position: "RB", rank: 5, adp: 5 },
    { id: "wr-2", name: "WR Two", position: "WR", rank: 6, adp: 6 },
    { id: "qb-3", name: "QB Three", position: "QB", rank: 7, adp: 7 },
    { id: "rb-3", name: "RB Three", position: "RB", rank: 8, adp: 8 },
    { id: "wr-3", name: "WR Three", position: "WR", rank: 9, adp: 9 },
    { id: "qb-4", name: "QB Four", position: "QB", rank: 10, adp: 10 },
  ],
  ...overrides,
});

const configForTeamCount = (teamCount: number): SnakeDraftConfig => {
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
  }));

  return {
    sessionId: `session-${teamCount}`,
    seed: "league-size-seed",
    rounds: 1,
    orderType: "standard",
    teamOrder: teams.map(team => team.id),
    humanTeamId: teams.at(-1)?.id ?? "missing-team",
    teams,
    rosterSlots: [
      { slot: "ANY", count: 1, eligiblePositions: ["FLEX"] },
    ],
    players: Array.from({ length: teamCount }, (_, index) => ({
      id: `player-${index + 1}`,
      name: `Player ${index + 1}`,
      position: "FLEX",
      rank: index + 1,
      adp: index + 1,
    })),
  };
};

describe("snake draft engine", () => {
  it("supports any league size from four through twenty teams", () => {
    expect(createSnakeDraftState(configForTeamCount(4)).board.picks).toHaveLength(4);
    const twentyTeamDraft = applySnakeDraftCommand(
      createSnakeDraftState(configForTeamCount(20)),
      { type: "start", expectedRevision: 0 },
    );
    expect(twentyTeamDraft.session.currentPick).toMatchObject({ overall: 20, teamId: "team-20" });
    expect(twentyTeamDraft.board.picks.slice(0, 19).every(pick => pick.selection?.source === "ai"))
      .toBe(true);
    expect(() => createSnakeDraftState(configForTeamCount(3)))
      .toThrowError(expect.objectContaining({ code: "invalid_config" }));
    expect(() => createSnakeDraftState(configForTeamCount(21)))
      .toThrowError(expect.objectContaining({ code: "invalid_config" }));
  });

  it("exposes snake planning metrics without auction semantics", () => {
    const state = createSnakeDraftState(baseConfig());
    const firstPlayer = state.board.players[0];

    expect(firstPlayer).toMatchObject({
      adp: 1,
      leagueExpectedPick: 1,
      personalRank: undefined,
      reachLimit: undefined,
    });
    expect(firstPlayer).not.toHaveProperty("price");
    expect(firstPlayer).not.toHaveProperty("expectedPrice");

    const config = baseConfig();
    const customized = createSnakeDraftState(baseConfig({
      players: config.players.map((player, index) => index === 0 ? {
        ...player,
        leagueExpectedPick: 7,
        personalRank: 2,
        reachLimit: 5,
      } : player),
    }));
    expect(customized.board.players[0]).toMatchObject({
      leagueExpectedPick: 7,
      personalRank: 2,
      reachLimit: 5,
    });
  });

  it("builds standard and third-round reversal schedules from explicit team order", () => {
    const rosterSlots = [
      { slot: "ANY", count: 4, eligiblePositions: ["QB", "RB", "WR"] },
    ];
    const players = Array.from({ length: 16 }, (_, index) => ({
      id: `schedule-player-${index + 1}`,
      name: `Schedule Player ${index + 1}`,
      position: "QB",
      rank: index + 1,
      adp: index + 1,
    }));
    const standard = createSnakeDraftState(baseConfig({ rounds: 4, rosterSlots, players }));
    const reversed = createSnakeDraftState(baseConfig({
      rounds: 4,
      orderType: "third_round_reversal",
      rosterSlots,
      players,
    }));

    expect(standard.board.picks.map(pick => pick.teamId)).toEqual([
      "team-a", "team-b", "team-c", "team-d",
      "team-d", "team-c", "team-b", "team-a",
      "team-a", "team-b", "team-c", "team-d",
      "team-d", "team-c", "team-b", "team-a",
    ]);
    expect(reversed.board.picks.map(pick => pick.teamId)).toEqual([
      "team-a", "team-b", "team-c", "team-d",
      "team-d", "team-c", "team-b", "team-a",
      "team-d", "team-c", "team-b", "team-a",
      "team-a", "team-b", "team-c", "team-d",
    ]);
  });

  it("rejects an explicit team order that duplicates or omits a team", () => {
    expect(() => createSnakeDraftState(baseConfig({
      teamOrder: ["team-a", "team-b", "team-c", "team-c"],
    }))).toThrowError(expect.objectContaining({ code: "invalid_config" }));
  });

  it("rejects rounds that exceed each team's roster capacity", () => {
    expect(() => createSnakeDraftState(baseConfig({ rounds: 3 })))
      .toThrowError(expect.objectContaining({ code: "invalid_config" }));
  });

  it("rejects duplicate player and roster slot identities", () => {
    const config = baseConfig();
    expect(() => createSnakeDraftState(baseConfig({
      players: [...config.players, { ...config.players[0]!, name: "Duplicate QB" }],
    }))).toThrowError(expect.objectContaining({ code: "invalid_config" }));
    expect(() => createSnakeDraftState(baseConfig({
      rosterSlots: [
        { slot: "FLEX", count: 1, eligiblePositions: ["RB"] },
        { slot: "FLEX", count: 1, eligiblePositions: ["WR"] },
      ],
    }))).toThrowError(expect.objectContaining({ code: "invalid_config" }));
    expect(() => createSnakeDraftState(baseConfig({
      rosterSlots: [
        { slot: "QB", count: 2, eligiblePositions: ["QB"] },
        { slot: "QB1", count: 1, eligiblePositions: ["QB"] },
      ],
    }))).toThrowError(expect.objectContaining({ code: "invalid_config" }));
  });

  it("rejects a player pool that cannot fill every scheduled pick", () => {
    expect(() => createSnakeDraftState(baseConfig({
      players: baseConfig().players.slice(0, 7),
    }))).toThrowError(expect.objectContaining({ code: "invalid_config" }));
  });

  it("starts a session and advances AI teams to the human pick", () => {
    const setup = createSnakeDraftState(baseConfig());

    const started = applySnakeDraftCommand(setup, { type: "start", expectedRevision: 0 });

    expect(started.session).toMatchObject({
      id: "snake-session",
      status: "active",
      revision: 1,
      currentPick: {
        overall: 3,
        round: 1,
        pickInRound: 3,
        teamId: "team-c",
      },
    });
    expect(started.board.picks.slice(0, 3).map(pick => ({
      teamId: pick.teamId,
      source: pick.selection?.source,
    }))).toEqual([
      { teamId: "team-a", source: "ai" },
      { teamId: "team-b", source: "ai" },
      { teamId: "team-c", source: undefined },
    ]);
  });

  it("rejects stale revisions without mutating the prior state", () => {
    const setup = createSnakeDraftState(baseConfig());

    expect(() => applySnakeDraftCommand(setup, {
      type: "start",
      expectedRevision: 1,
    })).toThrowError(expect.objectContaining({ code: "stale_revision" }));
    expect(setup.session).toMatchObject({ status: "setup", revision: 0, commandLog: [] });
    expect(setup.board.players.every(player => player.available)).toBe(true);
  });

  it("places keepers at their configured picks and advances past consumed turns", () => {
    const setup = createSnakeDraftState(baseConfig({
      keepers: [
        { teamId: "team-c", playerId: "rb-3", round: 1, pickInRound: 3 },
      ],
    }));

    const started = applySnakeDraftCommand(setup, { type: "start", expectedRevision: 0 });

    expect(started.session.currentPick).toMatchObject({ overall: 6, teamId: "team-c" });
    expect(started.board.picks[2]?.selection).toEqual({
      playerId: "rb-3",
      source: "keeper",
      rosterSlot: "FLEX",
    });
    expect(started.board.players.find(player => player.id === "rb-3")?.available).toBe(false);
    expect(started.teams.find(team => team.id === "team-c")?.roster).toHaveLength(1);
  });

  it("rejects a keeper placed at another team's scheduled pick", () => {
    const setup = createSnakeDraftState(baseConfig({
      keepers: [
        { teamId: "team-a", playerId: "rb-3", round: 1, pickInRound: 2 },
      ],
    }));

    expect(() => applySnakeDraftCommand(setup, { type: "start", expectedRevision: 0 }))
      .toThrowError(expect.objectContaining({ code: "invalid_keeper" }));
  });

  it("confirms a human pick and advances AI teams to the next human turn", () => {
    const started = applySnakeDraftCommand(
      createSnakeDraftState(baseConfig()),
      { type: "start", expectedRevision: 0 },
    );

    const picked = applySnakeDraftCommand(started, {
      type: "pick",
      expectedRevision: 1,
      playerId: "qb-3",
    });

    expect(picked.session).toMatchObject({
      revision: 2,
      currentPick: { overall: 6, teamId: "team-c" },
      canUndo: true,
    });
    expect(picked.board.picks[2]?.selection).toEqual({
      playerId: "qb-3",
      source: "human",
      rosterSlot: "QB",
    });
    expect(picked.board.picks.slice(3, 5).every(pick => pick.selection?.source === "ai")).toBe(true);
  });

  it("rejects duplicate players and picks that exceed roster slot limits", () => {
    const started = applySnakeDraftCommand(
      createSnakeDraftState(baseConfig()),
      { type: "start", expectedRevision: 0 },
    );
    const draftedPlayerId = started.board.picks[0]?.selection?.playerId;
    expect(draftedPlayerId).toBeDefined();
    expect(() => applySnakeDraftCommand(started, {
      type: "pick",
      expectedRevision: 1,
      playerId: draftedPlayerId ?? "missing-player",
    })).toThrowError(expect.objectContaining({ code: "duplicate_player" }));

    const ineligibleStarted = applySnakeDraftCommand(createSnakeDraftState(baseConfig({
      players: [
        ...baseConfig().players,
        { id: "te-1", name: "TE One", position: "TE", rank: 11, adp: 11 },
      ],
    })), { type: "start", expectedRevision: 0 });
    expect(() => applySnakeDraftCommand(ineligibleStarted, {
      type: "pick",
      expectedRevision: 1,
      playerId: "te-1",
    })).toThrowError(expect.objectContaining({ code: "roster_limit" }));
  });

  it("undoes the latest human decision and its following AI picks", () => {
    const started = applySnakeDraftCommand(
      createSnakeDraftState(baseConfig()),
      { type: "start", expectedRevision: 0 },
    );
    const picked = applySnakeDraftCommand(started, {
      type: "pick",
      expectedRevision: 1,
      playerId: "qb-3",
    });

    const undone = applySnakeDraftCommand(picked, { type: "undo", expectedRevision: 2 });

    expect(undone.session).toMatchObject({
      status: "active",
      revision: 3,
      currentPick: { overall: 3, teamId: "team-c" },
      canUndo: false,
      canComplete: false,
    });
    expect(undone.board.picks.slice(2, 5).every(pick => pick.selection === undefined)).toBe(true);
    expect(undone.board.players.find(player => player.id === "qb-3")?.available).toBe(true);
    expect(undone.teams.find(team => team.id === "team-c")?.roster).toEqual([]);
  });

  it("requires every scheduled pick before explicitly completing the session", () => {
    const started = applySnakeDraftCommand(createSnakeDraftState(baseConfig({
      rounds: 1,
      rosterSlots: [
        { slot: "ANY", count: 1, eligiblePositions: ["QB", "RB", "WR"] },
      ],
    })), { type: "start", expectedRevision: 0 });

    expect(() => applySnakeDraftCommand(started, {
      type: "complete",
      expectedRevision: 1,
    })).toThrowError(expect.objectContaining({ code: "draft_incomplete" }));

    const availablePlayer = started.board.players.find(player => player.available);
    expect(availablePlayer).toBeDefined();
    const picked = applySnakeDraftCommand(started, {
      type: "pick",
      expectedRevision: 1,
      playerId: availablePlayer?.id ?? "missing-player",
    });
    expect(picked.session).toMatchObject({
      status: "active",
      revision: 2,
      currentPick: undefined,
      canComplete: true,
    });

    const completed = applySnakeDraftCommand(picked, {
      type: "complete",
      expectedRevision: 2,
    });
    expect(completed.session).toMatchObject({
      status: "completed",
      revision: 3,
      canUndo: false,
      canComplete: false,
    });
  });

  it("deterministically replays accepted commands including undo", () => {
    const config = baseConfig();
    const started = applySnakeDraftCommand(
      createSnakeDraftState(config),
      { type: "start", expectedRevision: 0 },
    );
    const firstPick = applySnakeDraftCommand(started, {
      type: "pick",
      expectedRevision: 1,
      playerId: "qb-3",
    });
    const undone = applySnakeDraftCommand(firstPick, { type: "undo", expectedRevision: 2 });
    const replacement = applySnakeDraftCommand(undone, {
      type: "pick",
      expectedRevision: 3,
      playerId: "qb-3",
    });
    const finalPick = applySnakeDraftCommand(replacement, {
      type: "pick",
      expectedRevision: 4,
      playerId: "wr-3",
    });
    const completed = applySnakeDraftCommand(finalPick, {
      type: "complete",
      expectedRevision: 5,
    });

    expect(replaySnakeDraft(config, completed.session.commandLog)).toEqual(completed);
  });

  it("uses open roster needs when scoring deterministic AI picks", () => {
    const started = applySnakeDraftCommand(createSnakeDraftState(baseConfig({
      rosterSlots: [
        { slot: "QB", count: 1, eligiblePositions: ["QB"] },
        { slot: "RB", count: 1, eligiblePositions: ["RB"] },
        { slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR"] },
      ],
      ai: {
        rankWeight: 1,
        adpWeight: 1,
        rosterNeedWeight: 10,
        positionalRunWeight: 0,
        randomWeight: 0,
      },
      keepers: [
        { teamId: "team-a", playerId: "keeper-qb", round: 2, pickInRound: 4 },
      ],
      players: [
        { id: "keeper-qb", name: "Keeper QB", position: "QB", rank: 20, adp: 20 },
        { id: "value-wr", name: "Value WR", position: "WR", rank: 1, adp: 1 },
        { id: "needed-rb", name: "Needed RB", position: "RB", rank: 3, adp: 3 },
        { id: "other-rb", name: "Other RB", position: "RB", rank: 4, adp: 4 },
        { id: "other-wr", name: "Other WR", position: "WR", rank: 5, adp: 5 },
        { id: "depth-qb", name: "Depth QB", position: "QB", rank: 6, adp: 6 },
        { id: "depth-rb", name: "Depth RB", position: "RB", rank: 7, adp: 7 },
        { id: "depth-wr", name: "Depth WR", position: "WR", rank: 8, adp: 8 },
      ],
    })), { type: "start", expectedRevision: 0 });

    expect(started.board.picks[0]?.selection?.playerId).toBe("needed-rb");
  });

  it("scores AI value from rank and ADP rather than display-only league expectation", () => {
    const started = applySnakeDraftCommand(createSnakeDraftState(baseConfig({
      rounds: 1,
      rosterSlots: [
        { slot: "FLEX", count: 1, eligiblePositions: ["RB"] },
      ],
      ai: {
        rankWeight: 1,
        adpWeight: 10,
        rosterNeedWeight: 0,
        positionalRunWeight: 0,
        randomWeight: 0,
      },
      players: [
        {
          id: "rank-player",
          name: "Rank Player",
          position: "RB",
          rank: 1,
          adp: 20,
          leagueExpectedPick: 1,
        },
        {
          id: "adp-player",
          name: "ADP Player",
          position: "RB",
          rank: 4,
          adp: 1,
          leagueExpectedPick: 20,
        },
        { id: "depth-rb-1", name: "Depth RB One", position: "RB", rank: 5, adp: 5 },
        { id: "depth-rb-2", name: "Depth RB Two", position: "RB", rank: 6, adp: 6 },
      ],
    })), { type: "start", expectedRevision: 0 });

    expect(started.board.picks[0]?.selection?.playerId).toBe("adp-player");
  });

  it("uses the seed to resolve otherwise tied AI choices reproducibly", () => {
    const tiedConfig = (seed: string): SnakeDraftConfig => baseConfig({
      seed,
      rounds: 1,
      rosterSlots: [
        { slot: "RB", count: 1, eligiblePositions: ["RB"] },
      ],
      ai: {
        rankWeight: 0,
        adpWeight: 0,
        rosterNeedWeight: 0,
        positionalRunWeight: 0,
        randomWeight: 1,
      },
      players: [1, 2, 3, 4].map(index => ({
        id: `p${index}`,
        name: `Player ${index}`,
        position: "RB",
        rank: 1,
        adp: 1,
      })),
    });
    const firstAiPick = (seed: string): string | undefined => applySnakeDraftCommand(
      createSnakeDraftState(tiedConfig(seed)),
      { type: "start", expectedRevision: 0 },
    ).board.picks[0]?.selection?.playerId;

    expect(firstAiPick("s0")).toBe("p4");
    expect(firstAiPick("s0")).toBe("p4");
    expect(firstAiPick("s1")).toBe("p1");
  });

  it("responds to a positional run within the configured lookback window", () => {
    const started = applySnakeDraftCommand(createSnakeDraftState(baseConfig({
      rounds: 1,
      rosterSlots: [
        { slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR"] },
      ],
      ai: {
        rankWeight: 1,
        adpWeight: 0,
        rosterNeedWeight: 0,
        positionalRunWeight: 3,
        positionalRunWindow: 2,
        randomWeight: 0,
      },
      players: [
        { id: "run-rb-1", name: "Run RB One", position: "RB", rank: 1, adp: 1 },
        { id: "value-wr", name: "Value WR", position: "WR", rank: 2, adp: 2 },
        { id: "run-rb-2", name: "Run RB Two", position: "RB", rank: 3, adp: 3 },
        { id: "depth-wr", name: "Depth WR", position: "WR", rank: 4, adp: 4 },
      ],
    })), { type: "start", expectedRevision: 0 });

    expect(started.board.picks.slice(0, 2).map(pick => pick.selection?.playerId)).toEqual([
      "run-rb-1",
      "run-rb-2",
    ]);
  });

  it("applies optional owner tendencies without changing league-wide weights", () => {
    const started = applySnakeDraftCommand(createSnakeDraftState(baseConfig({
      rounds: 1,
      teams: [
        {
          id: "team-a",
          name: "Alpha",
          aiTendency: { positionPreferences: { WR: 5 } },
        },
        { id: "team-b", name: "Bravo" },
        { id: "team-c", name: "Charlie" },
        { id: "team-d", name: "Delta" },
      ],
      rosterSlots: [
        { slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR"] },
      ],
      ai: {
        rankWeight: 1,
        adpWeight: 0,
        rosterNeedWeight: 0,
        positionalRunWeight: 0,
        randomWeight: 0,
      },
      players: [
        { id: "top-rb", name: "Top RB", position: "RB", rank: 1, adp: 1 },
        { id: "preferred-wr", name: "Preferred WR", position: "WR", rank: 2, adp: 2 },
        { id: "depth-rb", name: "Depth RB", position: "RB", rank: 3, adp: 3 },
        { id: "depth-wr", name: "Depth WR", position: "WR", rank: 4, adp: 4 },
      ],
    })), { type: "start", expectedRevision: 0 });

    expect(started.board.picks[0]?.selection?.playerId).toBe("preferred-wr");
  });
});
