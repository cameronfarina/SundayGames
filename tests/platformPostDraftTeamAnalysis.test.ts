import { describe, expect, it } from "vitest";
import {
  analyzePostDraftTeam,
  type AnalyzePostDraftTeamInput,
  type PostDraftProjection,
  PostDraftTeamAnalysisError,
} from "../src/platform/postDraftTeamAnalysis.js";

const now = new Date("2026-09-08T12:00:00.000Z");

const projections = [
  ["cam-qb-1", "Cam QB 1", "QB", 300, 20],
  ["cam-qb-2", "Cam QB 2", "QB", 100, 8],
  ["cam-rb-1", "Cam RB 1", "RB", 250, 17],
  ["cam-rb-2", "Cam RB 2", "RB", 180, 13],
  ["cam-wr-1", "Cam WR 1", "WR", 240, 16],
  ["cam-wr-2", "Cam WR 2", "WR", 170, 12],
  ["sam-qb-1", "Sam QB 1", "QB", 320, 22],
  ["sam-rb-1", "Sam RB 1", "RB", 260, 18],
  ["sam-rb-2", "Sam RB 2", "RB", 200, 14],
  ["sam-rb-3", "Sam RB 3", "RB", 90, 7],
  ["sam-wr-1", "Sam WR 1", "WR", 250, 17],
  ["sam-wr-2", "Sam WR 2", "WR", 80, 6],
  ["alex-qb-1", "Alex QB 1", "QB", 280, 19],
  ["alex-rb-1", "Alex RB 1", "RB", 220, 15],
  ["alex-rb-2", "Alex RB 2", "RB", 160, 11],
  ["alex-wr-1", "Alex WR 1", "WR", 210, 14],
  ["alex-wr-2", "Alex WR 2", "WR", 190, 13],
  ["alex-wr-3", "Alex WR 3", "WR", 180, 12],
].map(([playerId, playerName, position, seasonProjectedPoints, weeklyProjectedPoints]) => ({
  playerId,
  playerName,
  position,
  seasonProjectedPoints,
  weeklyProjectedPoints,
})) as readonly PostDraftProjection[];

const camRosterPlayers = projections.slice(0, 6).map(({ playerId, playerName, position }) => ({
  playerId,
  playerName,
  position,
}));

const baseInput = {
  ownership: {
    userId: "user_cam",
    privateOwnerUserId: "user_cam",
    leagueId: "league_214674",
    seasonId: "season_2026",
    teamId: "team_cam",
    ownerId: "owner_cam",
  },
  evaluatedAt: now,
  currentWeek: 1,
  leagueSettings: {
    leagueId: "league_214674",
    seasonId: "season_2026",
    scoring: {
      id: "half-ppr-2026",
      rules: { reception: 0.5, passingTouchdown: 4 },
    },
    roster: {
      rosterSize: 6,
      starterSlots: [
        { slot: "QB", eligiblePositions: ["QB"] },
        { slot: "RB", eligiblePositions: ["RB"] },
        { slot: "WR", eligiblePositions: ["WR"] },
        { slot: "FLEX", eligiblePositions: ["RB", "WR"] },
      ],
    },
  },
  completedDraftRoster: {
    snapshotId: "draft-rosters-1",
    leagueId: "league_214674",
    seasonId: "season_2026",
    capturedAt: "2026-09-01T03:00:00.000Z",
    status: "complete",
    draftFormat: "snake",
    teams: [
      {
        teamId: "team_cam",
        ownerId: "owner_cam",
        players: camRosterPlayers,
      },
      {
        teamId: "team_sam",
        ownerId: "owner_sam",
        players: projections.slice(6, 12).map(({ playerId, playerName, position }) => ({
          playerId,
          playerName,
          position,
        })),
      },
      {
        teamId: "team_alex",
        ownerId: "owner_alex",
        players: projections.slice(12, 18).map(({ playerId, playerName, position }) => ({
          playerId,
          playerName,
          position,
        })),
      },
    ],
  },
  projectionSnapshot: {
    metadata: {
      snapshotId: "projections-1",
      leagueId: "league_214674",
      seasonId: "season_2026",
      scoringSettingsId: "half-ppr-2026",
      generatedAt: "2026-09-08T10:00:00.000Z",
      validThrough: "2026-09-10T00:00:00.000Z",
      week: 1,
      source: {
        kind: "weekly_scoring_specific",
        provider: "test projections",
        datasetId: "test-week-1",
        capturedAt: "2026-09-08T10:00:00.000Z",
        confidence: "high",
        weekly: true,
        scoringSpecific: true,
      },
    },
    projections,
  },
  currentRosterSnapshot: {
    snapshotId: "current-roster-1",
    leagueId: "league_214674",
    seasonId: "season_2026",
    teamId: "team_cam",
    privateOwnerUserId: "user_cam",
    capturedAt: "2026-09-08T11:30:00.000Z",
    validThrough: "2026-09-08T12:30:00.000Z",
    players: camRosterPlayers,
  },
} satisfies AnalyzePostDraftTeamInput;

describe("post-draft My Team analysis", () => {
  it("ranks the owned team with explainable starter, bench, and positional components", () => {
    const analysis = analyzePostDraftTeam(baseInput);

    expect(analysis.ownership).toEqual(baseInput.ownership);
    expect(analysis.ranking).toMatchObject({
      status: "available",
      rank: 1,
      teamCount: 3,
      overallScore: 62.02,
      components: {
        starterProjection: {
          projectedPoints: 970,
          filledSlots: 4,
          requiredSlots: 4,
          lineup: [
            expect.objectContaining({ slot: "QB", playerId: "cam-qb-1", projectedPoints: 300 }),
            expect.objectContaining({ slot: "RB", playerId: "cam-rb-1", projectedPoints: 250 }),
            expect.objectContaining({ slot: "WR", playerId: "cam-wr-1", projectedPoints: 240 }),
            expect.objectContaining({ slot: "FLEX", playerId: "cam-rb-2", projectedPoints: 180 }),
          ],
          leagueRank: 2,
          normalizedScore: 53.85,
          weight: 0.6,
        },
        benchDepth: {
          projectedPoints: 270,
          countedPlayers: 2,
          availableBenchSlots: 2,
          players: [
            expect.objectContaining({ playerId: "cam-wr-2", projectedPoints: 170 }),
            expect.objectContaining({ playerId: "cam-qb-2", projectedPoints: 100 }),
          ],
          leagueRank: 2,
          normalizedScore: 58.82,
          weight: 0.25,
        },
        positionalBalance: {
          score: 91.67,
          leagueRank: 1,
          normalizedScore: 100,
          weight: 0.15,
        },
      },
    });
    if (analysis.ranking.status !== "available") {
      throw new Error("Expected ranking to be available.");
    }
    expect(analysis.ranking.explanation).toEqual({
      formula: "starter projection 60% + bench depth 25% + positional balance 15%",
      projectionSnapshotId: "projections-1",
      scoringSettingsId: "half-ppr-2026",
    });
    expect(analysis.strengths).toContainEqual(expect.objectContaining({
      code: "balanced_positions",
      component: "positionalBalance",
    }));
  });

  it("readies start/sit from current weekly projections but names missing pickup/drop state", () => {
    const analysis = analyzePostDraftTeam(baseInput);

    expect(analysis.recommendationReadiness.startSit).toEqual({
      status: "ready",
      reasons: [],
      snapshotIds: ["projections-1", "current-roster-1"],
    });
    expect(analysis.recommendations.startSit).toMatchObject({
      status: "ready",
      reasons: [],
      records: expect.arrayContaining([
        {
          recommendationId: "start-sit:QB:cam-qb-1",
          slot: "QB",
          start: {
            playerId: "cam-qb-1",
            playerName: "Cam QB 1",
            position: "QB",
            projectedPoints: 20,
          },
          sit: {
            playerId: "cam-qb-2",
            playerName: "Cam QB 2",
            position: "QB",
            projectedPoints: 8,
          },
          projectedPointEdge: 12,
          explanation: "Cam QB 1 projects for 12 more points than Cam QB 2 in the QB slot.",
        },
      ]),
      snapshotIds: ["projections-1", "current-roster-1"],
    });
    expect(analysis.recommendationReadiness.pickupDrop).toEqual({
      status: "unavailable",
      reasons: [
        {
          code: "free_agent_snapshot_missing",
          input: "freeAgents",
          message: "A current free-agent snapshot is required for pickup/drop advice.",
        },
      ],
      snapshotIds: ["projections-1", "current-roster-1"],
    });
  });

  it("marks start/sit stale when the weekly projection snapshot has expired", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      projectionSnapshot: {
        ...baseInput.projectionSnapshot,
        metadata: {
          ...baseInput.projectionSnapshot.metadata,
          validThrough: "2026-09-08T11:59:59.000Z",
        },
      },
    });

    expect(analysis.recommendationReadiness.startSit).toEqual({
      status: "stale",
      reasons: [{
        code: "weekly_projections_stale",
        input: "weeklyProjections",
        message: "Weekly projections expired at 2026-09-08T11:59:59.000Z.",
        snapshotId: "projections-1",
      }],
      snapshotIds: ["projections-1", "current-roster-1"],
    });
  });

  it("marks pickup/drop stale when roster and free-agent snapshots have expired", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      currentRosterSnapshot: {
        snapshotId: "current-roster-1",
        leagueId: "league_214674",
        seasonId: "season_2026",
        teamId: "team_cam",
        privateOwnerUserId: "user_cam",
        capturedAt: "2026-09-08T10:00:00.000Z",
        validThrough: "2026-09-08T11:00:00.000Z",
      },
      freeAgentSnapshot: {
        snapshotId: "free-agents-1",
        leagueId: "league_214674",
        seasonId: "season_2026",
        capturedAt: "2026-09-08T10:30:00.000Z",
        validThrough: "2026-09-08T11:30:00.000Z",
      },
    });

    expect(analysis.recommendationReadiness.pickupDrop).toEqual({
      status: "stale",
      reasons: [
        {
          code: "current_roster_snapshot_stale",
          input: "currentRoster",
          message: "Current roster state expired at 2026-09-08T11:00:00.000Z.",
          snapshotId: "current-roster-1",
        },
        {
          code: "free_agent_snapshot_stale",
          input: "freeAgents",
          message: "Free-agent state expired at 2026-09-08T11:30:00.000Z.",
          snapshotId: "free-agents-1",
        },
      ],
      snapshotIds: ["projections-1", "current-roster-1", "free-agents-1"],
    });
  });

  it("does not rank or characterize a roster from projections for different scoring settings", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      projectionSnapshot: {
        ...baseInput.projectionSnapshot,
        metadata: {
          ...baseInput.projectionSnapshot.metadata,
          scoringSettingsId: "standard-2026",
        },
      },
    });

    expect(analysis.ranking).toEqual({
      status: "unavailable",
      teamCount: 3,
      reasons: [{
        code: "projection_scoring_settings_mismatch",
        message: "Projection snapshot projections-1 uses standard-2026, not half-ppr-2026.",
        projectionSnapshotId: "projections-1",
      }],
    });
    expect(analysis.strengths).toEqual([]);
    expect(analysis.risks).toEqual([]);
  });

  it("does not fabricate a league rank when season projection coverage is incomplete", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      projectionSnapshot: {
        ...baseInput.projectionSnapshot,
        projections: baseInput.projectionSnapshot.projections.filter(
          projection => projection.playerId !== "cam-wr-2",
        ),
      },
    });

    expect(analysis.ranking).toEqual({
      status: "unavailable",
      teamCount: 3,
      reasons: [{
        code: "projection_coverage_incomplete",
        message: "Season projections do not cover every player in the completed draft roster.",
        projectionSnapshotId: "projections-1",
        playerIds: ["cam-wr-2"],
      }],
    });
    expect(analysis.strengths).toEqual([]);
    expect(analysis.risks).toEqual([]);
  });

  it("rejects ownership context that is not private to the requesting user and owned team", () => {
    expect(() => analyzePostDraftTeam({
      ...baseInput,
      ownership: {
        ...baseInput.ownership,
        privateOwnerUserId: "user_sam",
      },
    })).toThrowError(new PostDraftTeamAnalysisError(
      "private_owner_mismatch",
      "My Team analysis must be private to the requesting user.",
    ));

    expect(() => analyzePostDraftTeam({
      ...baseInput,
      ownership: {
        ...baseInput.ownership,
        ownerId: "owner_sam",
      },
    })).toThrowError(new PostDraftTeamAnalysisError(
      "owned_team_mismatch",
      "Owned team team_cam belongs to owner_cam, not owner_sam.",
    ));
  });

  it("does not rank or claim strengths for a roster that cannot fill every starter slot", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      completedDraftRoster: {
        ...baseInput.completedDraftRoster,
        teams: baseInput.completedDraftRoster.teams.map(team => team.teamId === "team_cam"
          ? { ...team, players: team.players.slice(0, 4) }
          : team),
      },
    });

    expect(analysis.ranking).toEqual({
      status: "unavailable",
      teamCount: 3,
      reasons: [{
        code: "roster_materially_incomplete",
        message: "The roster fills 3 of 4 required starter slots, so draft rank and strengths are unavailable.",
        projectionSnapshotId: "projections-1",
      }],
    });
    expect(analysis.strengths).toEqual([]);
    expect(analysis.risks).toEqual([]);
  });

  it("does not rank or claim strengths for an empty roster", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      completedDraftRoster: {
        ...baseInput.completedDraftRoster,
        teams: baseInput.completedDraftRoster.teams.map(team => team.teamId === "team_cam"
          ? { ...team, players: [] }
          : team),
      },
    });

    expect(analysis.ranking).toEqual({
      status: "unavailable",
      teamCount: 3,
      reasons: [{
        code: "roster_materially_incomplete",
        message: "The roster is empty, so draft rank and strengths are unavailable.",
        projectionSnapshotId: "projections-1",
      }],
    });
    expect(analysis.strengths).toEqual([]);
    expect(analysis.risks).toEqual([]);
  });

  it("readies pickup/drop only when weekly, roster, and free-agent snapshots are fresh", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      projectionSnapshot: {
        ...baseInput.projectionSnapshot,
        projections: [
          ...baseInput.projectionSnapshot.projections,
          {
            playerId: "free-agent-qb",
            playerName: "Free Agent QB",
            position: "QB",
            seasonProjectedPoints: 180,
            weeklyProjectedPoints: 14,
          },
        ],
      },
      currentRosterSnapshot: {
        snapshotId: "current-roster-2",
        leagueId: "league_214674",
        seasonId: "season_2026",
        teamId: "team_cam",
        privateOwnerUserId: "user_cam",
        capturedAt: "2026-09-08T11:30:00.000Z",
        validThrough: "2026-09-08T12:30:00.000Z",
        players: baseInput.completedDraftRoster.teams[0]?.players ?? [],
      },
      freeAgentSnapshot: {
        snapshotId: "free-agents-2",
        leagueId: "league_214674",
        seasonId: "season_2026",
        capturedAt: "2026-09-08T11:45:00.000Z",
        validThrough: "2026-09-08T12:15:00.000Z",
        players: [{
          playerId: "free-agent-qb",
          playerName: "Free Agent QB",
          position: "QB",
        }],
      },
    });

    expect(analysis.recommendationReadiness.pickupDrop).toEqual({
      status: "ready",
      reasons: [],
      snapshotIds: ["projections-1", "current-roster-2", "free-agents-2"],
    });
    expect(analysis.recommendations.pickupDrop).toEqual({
      status: "ready",
      reasons: [],
      snapshotIds: ["projections-1", "current-roster-2", "free-agents-2"],
      records: [{
        recommendationId: "pickup-drop:free-agent-qb:cam-qb-2",
        add: {
          playerId: "free-agent-qb",
          playerName: "Free Agent QB",
          position: "QB",
          projectedPoints: 14,
        },
        drop: {
          playerId: "cam-qb-2",
          playerName: "Cam QB 2",
          position: "QB",
          projectedPoints: 8,
        },
        projectedPointGain: 6,
        explanation: "Free Agent QB projects for 6 more points than Cam QB 2 this week at QB.",
      }],
    });
  });

  it("keeps rankings and coach advice unavailable for a static fallback with unknown scoring", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      projectionSnapshot: {
        ...baseInput.projectionSnapshot,
        metadata: {
          snapshotId: "static-fallback-1",
          leagueId: "league_214674",
          seasonId: "season_2026",
          generatedAt: "2026-07-30T15:24:58.463Z",
          validThrough: "2026-07-30T15:24:58.463Z",
          source: {
            kind: "static_fallback",
            provider: "ESPN",
            datasetId: "espn-projections-2026-weeks-1-4",
            capturedAt: "2026-07-30T15:24:58.463Z",
            confidence: "low",
            weekly: false,
            scoringSpecific: false,
          },
        },
        projections: baseInput.projectionSnapshot.projections.map(projection => ({
          playerId: projection.playerId,
          playerName: projection.playerName,
          position: projection.position,
          seasonProjectedPoints: projection.seasonProjectedPoints,
        })),
      },
    });

    expect(analysis.ranking).toEqual({
      status: "unavailable",
      teamCount: 3,
      reasons: [{
        code: "projection_scoring_settings_unverified",
        message: "Projection snapshot static-fallback-1 was not calculated for this league's scoring settings.",
        projectionSnapshotId: "static-fallback-1",
      }],
    });
    expect(analysis.projectionProvenance).toEqual({
      snapshotId: "static-fallback-1",
      generatedAt: "2026-07-30T15:24:58.463Z",
      validThrough: "2026-07-30T15:24:58.463Z",
      source: {
        kind: "static_fallback",
        provider: "ESPN",
        datasetId: "espn-projections-2026-weeks-1-4",
        capturedAt: "2026-07-30T15:24:58.463Z",
        confidence: "low",
        weekly: false,
        scoringSpecific: false,
      },
    });
    expect(analysis.recommendationReadiness.startSit).toEqual({
      status: "unavailable",
      reasons: [
        {
          code: "weekly_projection_source_unverified",
          input: "weeklyProjections",
          message: "Static ESPN fallback data is not a current, league-scoring-specific weekly projection source.",
          snapshotId: "static-fallback-1",
        },
        {
          code: "projection_scoring_settings_unverified",
          input: "weeklyProjections",
          message: "Projection snapshot static-fallback-1 was not calculated for this league's scoring settings.",
          snapshotId: "static-fallback-1",
        },
        {
          code: "weekly_projections_wrong_week",
          input: "weeklyProjections",
          message: "Weekly projections are for week unknown, not week 1.",
          snapshotId: "static-fallback-1",
        },
        {
          code: "weekly_projection_coverage_incomplete",
          input: "weeklyProjections",
          message: "Weekly projections do not cover every player on the owned roster.",
          snapshotId: "static-fallback-1",
          playerIds: [
            "cam-qb-1",
            "cam-qb-2",
            "cam-rb-1",
            "cam-rb-2",
            "cam-wr-1",
            "cam-wr-2",
          ],
        },
        {
          code: "weekly_projections_stale",
          input: "weeklyProjections",
          message: "Weekly projections expired at 2026-07-30T15:24:58.463Z.",
          snapshotId: "static-fallback-1",
        },
      ],
      snapshotIds: ["static-fallback-1", "current-roster-1"],
    });
    expect(analysis.recommendations.startSit.records).toEqual([]);
    expect(analysis.recommendations.pickupDrop.records).toEqual([]);
  });

  it("does not mark pickup/drop ready when snapshots contain no roster or free-agent players", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      currentRosterSnapshot: {
        snapshotId: "current-roster-empty",
        leagueId: "league_214674",
        seasonId: "season_2026",
        teamId: "team_cam",
        privateOwnerUserId: "user_cam",
        capturedAt: "2026-09-08T11:30:00.000Z",
        validThrough: "2026-09-08T12:30:00.000Z",
      },
      freeAgentSnapshot: {
        snapshotId: "free-agents-empty",
        leagueId: "league_214674",
        seasonId: "season_2026",
        capturedAt: "2026-09-08T11:45:00.000Z",
        validThrough: "2026-09-08T12:15:00.000Z",
      },
    });

    expect(analysis.recommendationReadiness.pickupDrop).toMatchObject({
      status: "unavailable",
      reasons: [
        expect.objectContaining({ code: "current_roster_players_missing" }),
        expect.objectContaining({ code: "free_agent_players_missing" }),
      ],
    });
    expect(analysis.recommendations.pickupDrop.records).toEqual([]);
  });

  it("does not create start/sit records without a fresh current roster", () => {
    const { currentRosterSnapshot: _currentRosterSnapshot, ...inputWithoutCurrentRoster } = baseInput;
    const analysis = analyzePostDraftTeam(inputWithoutCurrentRoster);

    expect(analysis.recommendationReadiness.startSit).toEqual({
      status: "unavailable",
      reasons: [{
        code: "current_roster_snapshot_missing",
        input: "currentRoster",
        message: "A current roster snapshot is required for start/sit and pickup/drop advice.",
      }],
      snapshotIds: ["projections-1"],
    });
    expect(analysis.recommendations.startSit).toEqual({
      status: "unavailable",
      reasons: analysis.recommendationReadiness.startSit.reasons,
      snapshotIds: ["projections-1"],
      records: [],
    });
  });

  it("does not create pickup/drop records when weekly projections miss a free agent", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      freeAgentSnapshot: {
        snapshotId: "free-agents-without-projections",
        leagueId: "league_214674",
        seasonId: "season_2026",
        capturedAt: "2026-09-08T11:45:00.000Z",
        validThrough: "2026-09-08T12:15:00.000Z",
        players: [{
          playerId: "unknown-free-agent",
          playerName: "Unknown Free Agent",
          position: "WR",
        }],
      },
    });

    expect(analysis.recommendationReadiness.pickupDrop).toMatchObject({
      status: "unavailable",
      reasons: [{
        code: "free_agent_projection_coverage_incomplete",
        input: "weeklyProjections",
        message: "Weekly projections do not cover every available free agent.",
        snapshotId: "projections-1",
        playerIds: ["unknown-free-agent"],
      }],
    });
    expect(analysis.recommendations.pickupDrop.records).toEqual([]);
  });

  it("keeps start/sit unavailable when weekly projections omit an owned player", () => {
    const analysis = analyzePostDraftTeam({
      ...baseInput,
      projectionSnapshot: {
        ...baseInput.projectionSnapshot,
        projections: baseInput.projectionSnapshot.projections.map(projection =>
          projection.playerId === "cam-wr-2"
            ? {
                playerId: projection.playerId,
                playerName: projection.playerName,
                position: projection.position,
                seasonProjectedPoints: projection.seasonProjectedPoints,
              }
            : projection
        ),
      },
    });

    expect(analysis.recommendationReadiness.startSit).toEqual({
      status: "unavailable",
      reasons: [{
        code: "weekly_projection_coverage_incomplete",
        input: "weeklyProjections",
        message: "Weekly projections do not cover every player on the owned roster.",
        snapshotId: "projections-1",
        playerIds: ["cam-wr-2"],
      }],
      snapshotIds: ["projections-1", "current-roster-1"],
    });
  });

  it("produces the same ranking for auction and snake draft snapshots", () => {
    const snakeAnalysis = analyzePostDraftTeam(baseInput);
    const auctionAnalysis = analyzePostDraftTeam({
      ...baseInput,
      completedDraftRoster: {
        ...baseInput.completedDraftRoster,
        draftFormat: "auction",
      },
    });

    expect(auctionAnalysis.ranking).toEqual(snakeAnalysis.ranking);
    expect(auctionAnalysis.strengths).toEqual(snakeAnalysis.strengths);
    expect(auctionAnalysis.risks).toEqual(snakeAnalysis.risks);
  });
});
