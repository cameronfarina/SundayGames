import { assignedLeague } from "./MyTeamPage.testServer";

export const endedLeague = {
  ...assignedLeague,
  liveDraft: { roomId: "room-1", status: "ended" },
};

export const recommendationReadiness = {
  startSit: { status: "ready", reasons: [], snapshotIds: ["projection-1"] },
  pickupDrop: {
    status: "unavailable",
    reasons: [{
      code: "free_agent_snapshot_missing",
      input: "freeAgents",
      message: "Current free agents are required for pickup and drop advice.",
    }],
    snapshotIds: ["projection-1"],
  },
};

export const postDraftResult = {
  roster: {
    teamId: "team-cam",
    ownerId: "cam",
    players: [
      { playerId: "achane", playerName: "De'Von Achane", position: "RB" },
      { playerId: "smith", playerName: "DeVonta Smith", position: "WR" },
    ],
  },
  analysis: {
    ownership: {
      userId: "account-cam",
      privateOwnerUserId: "account-cam",
      leagueId: "league-1",
      seasonId: "season-2026",
      teamId: "team-cam",
      ownerId: "cam",
    },
    generatedAt: "2026-08-31T02:00:00.000Z",
    projectionProvenance: {
      snapshotId: "projection-1",
      generatedAt: "2026-08-30T12:00:00.000Z",
      validThrough: "2026-09-01T12:00:00.000Z",
      source: {
        kind: "weekly_scoring_specific",
        provider: "Mockd",
        datasetId: "week-1",
        capturedAt: "2026-08-30T12:00:00.000Z",
        confidence: "high",
        weekly: true,
        scoringSpecific: true,
      },
    },
    ranking: { status: "available", rank: 2, teamCount: 14, overallScore: 86.4 },
    strengths: [{
      code: "strong_starters",
      component: "starterProjection",
      summary: "The starting lineup projects near the top of the league.",
      evidence: "Second-highest starter projection.",
    }],
    risks: [{
      code: "thin_bench",
      component: "benchDepth",
      summary: "Bench depth trails the league.",
      evidence: "Two bench spots lack weekly upside.",
    }],
    recommendationReadiness,
    recommendations: {
      startSit: {
        ...recommendationReadiness.startSit,
        records: [{
          recommendationId: "start-achane",
          slot: "RB",
          start: {
            playerId: "achane",
            playerName: "De'Von Achane",
            position: "RB",
            projectedPoints: 18.2,
          },
          projectedPointEdge: 6.1,
          explanation: "Start De'Von Achane at RB.",
        }],
      },
      pickupDrop: { ...recommendationReadiness.pickupDrop, records: [] },
    },
  },
};
