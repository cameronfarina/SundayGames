import type {
  AuctionLeagueSeasonSettings,
  BuildCurrentMockdLeagueSeasonOptions,
  FantasyTeam,
  LeagueSeason,
  LineupSettings,
  RosterMaximums,
  StaticLeagueConfig,
} from "./contracts.js";
import { defaultKeeperPolicy, defaultLeagueName, defaultSeasonYear } from "./defaults.js";

const slugFor = (value: string): string => value.trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const teamFor = (owner: string, index: number, seasonId: string): FantasyTeam => {
  const ownerSlug = slugFor(owner);
  return {
    id: `${seasonId}-team-${String(index + 1).padStart(2, "0")}-${ownerSlug}`,
    leagueSeasonId: seasonId,
    ownerId: `owner-${ownerSlug}`,
    ownerDisplayName: owner,
    displayName: owner,
    draftOrderPosition: index + 1,
  };
};

const rosterMaximums = (source: RosterMaximums): RosterMaximums => ({
  QB: source.QB, RB: source.RB, WR: source.WR,
  TE: source.TE, K: source.K, DST: source.DST,
});

const slotCount = (lineup: LineupSettings): number =>
  Object.values(lineup).reduce((total, count) => total + count, 0);

export const buildCurrentMockdLeagueSeason = (
  owners: readonly string[],
  config: StaticLeagueConfig,
  options: BuildCurrentMockdLeagueSeasonOptions = {},
): LeagueSeason<AuctionLeagueSeasonSettings> => {
  const seasonYear = options.seasonYear ?? defaultSeasonYear;
  const leagueId = `league-${config.leagueId}`;
  const id = `${leagueId}-season-${seasonYear}`;
  const lineup = { ...config.lineup };
  return {
    id,
    league: {
      id: leagueId,
      externalLeagueId: String(config.leagueId),
      name: options.leagueName ?? defaultLeagueName,
      provider: "mockd",
    },
    leagueId,
    seasonYear,
    teams: owners.map((owner, index) => teamFor(owner, index, id)),
    settings: {
      expectedTeamCount: config.teams,
      draftFormat: "auction",
      scoring: { ...config.scoring },
      auction: { budgetDollars: config.auctionBudget, minimumBidDollars: 1 },
      roster: {
        rosterSize: config.rosterSize,
        lineup,
        lineupSlotCount: slotCount(lineup),
        rosterMaximums: rosterMaximums(config.rosterMaximums),
      },
      keeperPolicy: { ...defaultKeeperPolicy },
    },
    setupStatus: options.setupStatus ?? "draft",
    ...(options.draft === undefined ? {} : { draft: { ...options.draft } }),
  };
};
