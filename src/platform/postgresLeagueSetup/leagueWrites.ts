import type { LeagueSeason } from "../leagueSeason.js";
import { leagueSlugBase } from "../leagueSlug.js";
import type { ArchiveLeagueRepositoryInput } from "../leagueSetup.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { firstRow, jsonbParameter } from "./databaseValues.js";
import { settingsJsonFor } from "./settingsMapping.js";

interface LeagueSlugRow {
  id: string;
  slug: string;
}

const publicLeagueSlug = async (
  client: PostgresQueryClient,
  leagueId: string,
  leagueName: string,
): Promise<string> => {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    ["mockd:league-slug-allocation"],
  );
  const baseSlug = leagueSlugBase(leagueName);
  const result = await client.query<LeagueSlugRow>(`
SELECT id, slug
FROM leagues
WHERE id = $1 OR slug = $2 OR slug LIKE $3;
`.trim(), [leagueId, baseSlug, `${baseSlug}-%`]);
  const current = result.rows.find(row => row.id === leagueId);
  if (current !== undefined) return current.slug;

  const used = new Set(result.rows.map(row => row.slug));
  if (!used.has(baseSlug)) return baseSlug;
  let suffix = 2;
  while (used.has(`${baseSlug}-${String(suffix)}`)) suffix += 1;
  return `${baseSlug}-${String(suffix)}`;
};

export const upsertLeague = async (
  client: PostgresQueryClient,
  season: LeagueSeason,
  createdByUserId: string,
  now: Date,
): Promise<void> => {
  const slug = await publicLeagueSlug(client, season.league.id, season.league.name);
  await client.query(`
INSERT INTO leagues (
  id, name, slug, sport, provider, provider_league_id, created_by_user_id, created_at, updated_at
) VALUES ($1, $2, $3, 'football', $4, $5, $6, $7, $7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  provider_league_id = EXCLUDED.provider_league_id,
  updated_at = EXCLUDED.updated_at;
`.trim(), [
    season.league.id,
    season.league.name,
    slug,
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
