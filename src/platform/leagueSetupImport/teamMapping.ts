import type { FantasyTeam, LeagueSeason } from "../leagueSeason.js";
import { normalizeDuplicateKey, slugFor } from "./normalization.js";
import type {
  LeagueSetupMembershipSeed,
  LeagueSetupTeamRecord,
} from "./types.js";

const existingTeamFor = (
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

export const teamForRecord = (
  season: LeagueSeason,
  record: LeagueSetupTeamRecord,
  index: number,
): FantasyTeam => {
  const existingTeam = existingTeamFor(season, record);
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
