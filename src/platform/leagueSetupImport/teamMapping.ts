import type { FantasyTeam, LeagueSeason } from "../leagueSeason.js";
import { normalizeDuplicateKey, slugFor } from "./normalization.js";
import type {
  LeagueSetupMembershipSeed,
  LeagueSetupTeamRecord,
} from "./types.js";

const namedTeamFor = (
  season: LeagueSeason,
  record: LeagueSetupTeamRecord,
): FantasyTeam | undefined => {
  if (record.existingTeamId !== undefined) {
    return season.teams.find(team => team.id === record.existingTeamId);
  }

  return season.teams.find(team =>
    normalizeDuplicateKey(team.ownerDisplayName)
      === normalizeDuplicateKey(record.ownerDisplayName)
  );
};

/**
 * Matches each submitted row to the team it replaces. Rows are matched by id
 * or manager name first, and anything left over keeps the team standing in the
 * same draft slot. Without that fallback a renamed manager creates a new team,
 * which strands their keepers on a team id the season no longer holds.
 */
export const existingTeamsForRecords = (
  season: LeagueSeason,
  records: readonly LeagueSetupTeamRecord[],
): readonly (FantasyTeam | undefined)[] => {
  const claimed = new Set<string>();
  const claim = (team: FantasyTeam | undefined): FantasyTeam | undefined => {
    if (team === undefined || claimed.has(team.id)) return undefined;
    claimed.add(team.id);
    return team;
  };
  const namedMatches = records.map(record => claim(namedTeamFor(season, record)));

  return namedMatches.map((team, index) => team ?? claim(season.teams[index]));
};

export const teamForRecord = (
  season: LeagueSeason,
  record: LeagueSetupTeamRecord,
  index: number,
  existingTeam: FantasyTeam | undefined,
): FantasyTeam => {
  const draftPositionTeam = season.teams[index];
  const ownerSlug = slugFor(record.ownerDisplayName) || `team-${index + 1}`;
  const teamOrdinal = String(index + 1).padStart(2, "0");

  return {
    id: existingTeam?.id ?? `${season.id}-team-${teamOrdinal}-${ownerSlug}`,
    leagueSeasonId: season.id,
    ownerId: existingTeam?.ownerId ?? `owner-${ownerSlug}`,
    ownerDisplayName: record.ownerDisplayName,
    ...(record.managerDisplayNames === undefined
      ? {}
      : { managerDisplayNames: [...record.managerDisplayNames] }),
    ...(record.abbreviation === undefined ? {} : { abbreviation: record.abbreviation }),
    displayName: record.teamDisplayName,
    draftOrderPosition: record.draftOrderPosition
      ?? draftPositionTeam?.draftOrderPosition
      ?? index + 1,
  };
};

export const membershipSeedFor = (
  leagueId: string,
  record: LeagueSetupTeamRecord,
  team: FantasyTeam,
): LeagueSetupMembershipSeed => ({
  leagueId,
  ownerId: team.ownerId,
  teamId: team.id,
  ownerDisplayName: record.ownerDisplayName,
  teamDisplayName: record.teamDisplayName,
  ...(record.email === undefined ? {} : { email: record.email }),
  role: record.role,
});
