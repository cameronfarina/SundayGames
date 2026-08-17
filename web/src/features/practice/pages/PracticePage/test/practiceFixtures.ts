export const player = {
  byeWeek: 11,
  expectedPrice: 73,
  marketPrice: 70,
  myValue: 75,
  name: "Puka Nacua",
  position: "WR",
  teamAbbreviation: "LAR",
};

export const target = {
  createdAt: "2026-08-13T12:00:00.000Z",
  id: "target-puka",
  leagueId: "league-1",
  playerName: "Puka Nacua",
  position: "WR",
  priority: 1,
  seasonId: "season-1",
  updatedAt: "2026-08-13T12:00:00.000Z",
  userId: "user-1",
};

export const simulationSummaryFixture = {
  completedCount: 1,
  draftFormat: "auction",
  outcomes: [
    { favorite: false, rank: 1, runNumber: 1, userWeek1Points: 106.5 },
    { favorite: false, rank: 2, runNumber: 2, userWeek1Points: 99.2 },
  ],
  playerExposure: [],
  positionCounts: {},
  runCount: 1,
  seedPrefix: "test",
  strategy: { preferredPositions: [], rawInput: "", summary: "Balanced", warnings: [] },
};

export const simulationRunFixture = {
  label: "Run 1",
  runNumber: 1,
  seed: "one",
  teams: [{
    budgetRemaining: 0,
    isUserTeam: true,
    roster: [],
    spent: 200,
    teamId: "team-1",
    teamName: "Short King",
    week1Points: 106.5,
  }],
};

export const league = (teamClaimed: boolean) => ({
  canManageLeague: true,
  leagueId: "league-1",
  leagueName: "Sunday Games",
  leagueSlug: "sunday-games",
  liveDraft: null,
  membership: { role: "owner", ...(teamClaimed ? { teamId: "team-1" } : {}) },
  readiness: {
    leagueSetup: "ready",
    liveDraft: "needs_attention",
    teamClaim: teamClaimed ? "ready" : "needs_attention",
  },
  seasonId: "season-1",
  seasonYear: 2026,
});
