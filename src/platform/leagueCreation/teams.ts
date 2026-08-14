import type { FantasyTeam } from "../leagueSeason.js";
import { LeagueCreationError } from "./errors.js";
import type { ConfirmedLeagueTeamInput } from "./types.js";
import { requiredText } from "./validation.js";

interface CreatedTeams {
  teams: FantasyTeam[];
  teamIdByExternalId: ReadonlyMap<string, string>;
}

export const createTeams = (
  inputs: readonly ConfirmedLeagueTeamInput[],
  seasonId: string,
  createId: () => string,
): CreatedTeams => {
  const externalIds = new Set<string>();
  const teamIdByExternalId = new Map<string, string>();
  const teams = inputs.map((team, index): FantasyTeam => {
    const externalTeamId = requiredText(team.externalTeamId, "External team ID");
    if (externalIds.has(externalTeamId)) {
      throw new LeagueCreationError(`External team ID ${externalTeamId} is duplicated.`);
    }
    externalIds.add(externalTeamId);
    const displayName = requiredText(team.displayName, "Team name");
    const managers = (team.managerNames ?? []).map(name => name.trim()).filter(Boolean);
    const created: FantasyTeam = {
      id: `team-${createId()}`,
      leagueSeasonId: seasonId,
      ownerId: `owner-${createId()}`,
      ownerDisplayName: managers[0] ?? displayName,
      ...(managers.length === 0 ? {} : { managerDisplayNames: managers }),
      ...(team.abbreviation === undefined || team.abbreviation === null || team.abbreviation.trim() === ""
        ? {}
        : { abbreviation: team.abbreviation.trim() }),
      displayName,
      draftOrderPosition: index + 1,
    };
    teamIdByExternalId.set(externalTeamId, created.id);
    return created;
  });
  return { teams, teamIdByExternalId };
};
