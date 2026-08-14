import type { LeagueSeason } from "../leagueSeason.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { firstRow } from "./databaseValues.js";
import type { LeagueSeasonRow } from "./rows.js";
import { seasonFromRow } from "./seasonMapping.js";
import { selectLeagueSeasonSql } from "./selectLeagueSeasonSql.js";

export const findLeagueSeason = async (
  client: PostgresQueryClient,
  seasonId: string,
): Promise<LeagueSeason | null> => {
  const result = await client.query<LeagueSeasonRow>(
    `${selectLeagueSeasonSql} WHERE s.id = $1`,
    [seasonId],
  );
  const row = firstRow(result);
  return row === undefined ? null : await seasonFromRow(client, row);
};

export const findLeagueSeasonForLeagueYear = async (
  client: PostgresQueryClient,
  leagueId: string,
  seasonYear: number,
): Promise<LeagueSeason | null> => {
  const result = await client.query<LeagueSeasonRow>(
    `${selectLeagueSeasonSql} WHERE s.league_id = $1 AND s.season_year = $2`,
    [leagueId, seasonYear],
  );
  const row = firstRow(result);
  return row === undefined ? null : await seasonFromRow(client, row);
};

export const hasLeagueSeasonForLeague = async (
  client: PostgresQueryClient,
  leagueId: string,
): Promise<boolean> => {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM league_seasons WHERE league_id = $1 LIMIT 1",
    [leagueId],
  );
  return firstRow(result) !== undefined;
};
