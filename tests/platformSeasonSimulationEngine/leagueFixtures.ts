import type {
  AuctionLeagueSeasonSettings,
  FantasyTeam,
  KeeperPolicy,
  LeagueSeason,
  ScoringSettings,
  SnakeLeagueSeasonSettings,
} from "../../src/platform/leagueSeason.js";

export const teams: FantasyTeam[] = ["Owner11", "Owner12", "Matt", "Nick"].map(
  (name, index) => ({
    id: `team-${index + 1}`,
    leagueSeasonId: "season-2026",
    ownerId: `owner-${index + 1}`,
    ownerDisplayName: name,
    displayName: `${name} Team`,
    draftOrderPosition: index + 1,
  }),
);

export const scoring: ScoringSettings = {
  passingYards: 0.04,
  passingTouchdown: 4,
  rushingYards: 0.1,
  rushingTouchdown: 6,
  receivingYards: 0.1,
  receivingTouchdown: 6,
  reception: 0.5,
};

export const keeperPolicy: KeeperPolicy = {
  mode: "previous-cost-multiplier",
  multiplier: 1.2,
  rounding: "ceil",
};

export const commonSeason: Omit<
  LeagueSeason<AuctionLeagueSeasonSettings>,
  "settings"
> = {
  id: "season-2026",
  leagueId: "league-1",
  league: {
    id: "league-1",
    externalLeagueId: "1",
    name: "Sunday",
    provider: "espn",
  },
  seasonYear: 2026,
  setupStatus: "published",
  teams,
};

export const auctionSeason: LeagueSeason<AuctionLeagueSeasonSettings> = {
  ...commonSeason,
  settings: {
    expectedTeamCount: 4,
    draftFormat: "auction",
    scoring,
    auction: { budgetDollars: 50, minimumBidDollars: 1 },
    roster: {
      rosterSize: 2,
      lineup: { RB: 1, FLEX: 1 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
    },
    keeperPolicy,
  },
};

export const snakeSeason: LeagueSeason<SnakeLeagueSeasonSettings> = {
  ...commonSeason,
  settings: {
    expectedTeamCount: 4,
    draftFormat: "snake",
    scoring,
    snake: {
      rounds: 2,
      order: teams.map(team => team.id),
    },
    roster: {
      rosterSize: 2,
      lineup: { RB: 1, FLEX: 1 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
    },
    keeperPolicy,
  },
};
