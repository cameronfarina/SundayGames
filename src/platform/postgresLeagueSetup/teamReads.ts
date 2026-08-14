import type { FantasyTeam } from "../leagueSeason.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { stringArrayFromDb } from "./databaseValues.js";
import type { FantasyTeamRow } from "./rows.js";

export const teamsForSeason = async (
  client: PostgresQueryClient,
  seasonId: string,
): Promise<FantasyTeam[]> => {
  const result = await client.query<FantasyTeamRow>(`
SELECT id, league_season_id, team_key, team_name, owner_name, abbreviation, manager_names_json, display_order
FROM fantasy_teams
WHERE league_season_id = $1
ORDER BY display_order ASC, id ASC
`.trim(), [seasonId]);

  return result.rows.map(row => {
    const managerDisplayNames = stringArrayFromDb(row.manager_names_json);
    const abbreviation = typeof row.abbreviation === "string" ? row.abbreviation.trim() : "";
    return {
      id: row.id,
      leagueSeasonId: row.league_season_id,
      ownerId: row.team_key,
      ownerDisplayName: row.owner_name,
      ...(managerDisplayNames.length === 0 ? {} : { managerDisplayNames }),
      ...(abbreviation.length === 0 ? {} : { abbreviation }),
      displayName: row.team_name,
      draftOrderPosition: Number(row.display_order),
    };
  });
};
