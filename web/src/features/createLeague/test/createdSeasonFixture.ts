export const createdSeasonFixture = {
  id: "season-new",
  league: {
    id: "league-new",
    externalLeagueId: "mockd-2026-sunday-games",
    name: "Sunday Games",
    provider: "mockd",
  },
  leagueId: "league-new",
  seasonYear: 2026,
  teams: [],
  settings: {
    expectedTeamCount: 2,
    draftFormat: "auction",
    scoring: {
      passingYards: 0.04,
      passingTouchdown: 4,
      rushingYards: 0.1,
      rushingTouchdown: 6,
      receivingYards: 0.1,
      receivingTouchdown: 6,
      reception: 0.5,
    },
    auction: { budgetDollars: 200, minimumBidDollars: 1 },
    roster: {
      rosterSize: 16,
      lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1, BENCH: 7 },
      lineupSlotCount: 16,
      rosterMaximums: { QB: 1, RB: 2, WR: 2, TE: 1, DST: 1, K: 1 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
  setupStatus: "draft",
};
