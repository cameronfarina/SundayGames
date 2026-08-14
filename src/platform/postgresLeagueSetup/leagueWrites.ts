import type { LeagueSeason } from "../leagueSeason.js";
import type { ArchiveLeagueRepositoryInput } from "../leagueSetup.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { firstRow, jsonbParameter } from "./databaseValues.js";
import { settingsJsonFor } from "./settingsMapping.js";

export const upsertLeague = async (
  client: PostgresQueryClient,
  season: LeagueSeason,
  createdByUserId: string,
  now: Date,
): Promise<void> => {
  await client.query(`
INSERT INTO leagues (
  id, name, sport, provider, provider_league_id, created_by_user_id, created_at, updated_at
) VALUES ($1, $2, 'football', $3, $4, $5, $6, $6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  provider_league_id = EXCLUDED.provider_league_id,
  updated_at = EXCLUDED.updated_at;
`.trim(), [
    season.league.id,
    season.league.name,
    season.league.provider,
    season.league.externalLeagueId,
    createdByUserId,
    now,
  ]);
};

export const upsertSeason = async (
  client: PostgresQueryClient,
  season: LeagueSeason,
  now: Date,
): Promise<void> => {
  await client.query(`
INSERT INTO league_seasons (
  id, league_id, season_year, name, status, settings_json, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $7)
ON CONFLICT (id) DO UPDATE SET
  league_id = EXCLUDED.league_id,
  season_year = EXCLUDED.season_year,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  settings_json = EXCLUDED.settings_json,
  updated_at = EXCLUDED.updated_at;
`.trim(), [
    season.id,
    season.leagueId,
    season.seasonYear,
    season.league.name,
    season.setupStatus,
    jsonbParameter(settingsJsonFor(season)),
    now,
  ]);
};

export const archiveLeague = async (
  client: PostgresQueryClient,
  input: ArchiveLeagueRepositoryInput,
): Promise<boolean> => {
  const archivedAt = input.now ?? new Date();
  const result = await client.query<{ id: string }>(`
UPDATE leagues
SET archived_at = COALESCE(archived_at, $3),
    archived_by_user_id = COALESCE(archived_by_user_id, $2),
    updated_at = $3
WHERE id = $1
RETURNING id;
`.trim(), [input.leagueId, input.archivedByUserId, archivedAt]);
  return firstRow(result) !== undefined;
};

export const isLeagueArchived = async (
  client: PostgresQueryClient,
  leagueId: string,
): Promise<boolean> => {
  const result = await client.query<{ archived: boolean }>(
    "SELECT archived_at IS NOT NULL AS archived FROM leagues WHERE id = $1 LIMIT 1",
    [leagueId],
  );
  return firstRow(result)?.archived ?? false;
};
