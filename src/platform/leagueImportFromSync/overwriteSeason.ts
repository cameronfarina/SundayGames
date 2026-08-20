import {
  leagueSeasonSettingsFor,
  type ConfirmedLeagueCreationInput,
  type ConfirmedLeagueTeamInput,
} from "../leagueCreation.js";
import type { ExplicitLeagueSeason, FantasyTeam, LeagueSeason } from "../leagueSeason.js";
import { existingTeamsForRecords, teamForRecord } from "../leagueSetupImport/teamMapping.js";
import type { LeagueSetupTeamRecord } from "../leagueSetupImport.js";

const teamRecordFor = (
  team: ConfirmedLeagueTeamInput,
  index: number,
): LeagueSetupTeamRecord => ({
  sourceRowNumber: index + 1,
  ownerDisplayName: team.managerNames?.[0] ?? team.displayName,
  teamDisplayName: team.displayName,
  ...(team.managerNames === undefined ? {} : { managerDisplayNames: [...team.managerNames] }),
  draftOrderPosition: index + 1,
  role: "member",
});

interface RebuiltTeam {
  externalTeamId: string;
  team: FantasyTeam;
}

/**
 * Teams keep the ids the season already gave them, matched by manager name and
 * then by draft slot. Everything the league owns is keyed to those ids —
 * keepers, claimed teams, memberships — so a re-import that minted new ids
 * would quietly strand all of it.
 */
const rebuiltTeams = (
  season: LeagueSeason,
  teams: readonly ConfirmedLeagueTeamInput[],
): readonly RebuiltTeam[] => {
  const records = teams.map(teamRecordFor);
  const existing = existingTeamsForRecords(season, records);

  return records.map((record, index) => ({
    externalTeamId: (teams[index]?.externalTeamId ?? "").trim(),
    team: teamForRecord(season, record, index, existing[index]),
  }));
};

/**
 * Rewrites a season the owner already manages from an imported league, keeping
 * the season, league, and public slug the same so every link to it still works.
 */
export const seasonFromLeagueImport = (
  season: LeagueSeason,
  input: ConfirmedLeagueCreationInput,
): ExplicitLeagueSeason => {
  const rebuilt = rebuiltTeams(season, input.teams);
  const teamIdByExternalId = new Map(
    rebuilt.map(entry => [entry.externalTeamId, entry.team.id]),
  );

  return {
    ...season,
    league: {
      ...season.league,
      name: input.leagueName,
      provider: input.provider,
      externalLeagueId: input.externalLeagueId,
    },
    seasonYear: input.seasonYear,
    teams: rebuilt.map(entry => entry.team),
    settings: leagueSeasonSettingsFor(input, teamIdByExternalId),
  };
};
