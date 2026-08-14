import type { FantasyTeam, LeagueSeason } from "../leagueSeason.js";
import type { PlatformLeagueMembership } from "../leagueSetup.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { firstRow, jsonbParameter } from "./databaseValues.js";
import { teamOwnerUserIdFor } from "./identifiers.js";
import type { MaxDisplayOrderRow } from "./rows.js";

const shiftExistingTeamDisplayOrders = async (
  client: PostgresQueryClient,
  season: LeagueSeason,
  now: Date,
): Promise<void> => {
  const result = await client.query<MaxDisplayOrderRow>(`
SELECT COALESCE(MAX(display_order), 0)::integer AS max_display_order
FROM fantasy_teams
WHERE league_season_id = $1;
`.trim(), [season.id]);
  const currentMax = firstRow(result)?.max_display_order ?? 0;
  if (currentMax === 0) return;

  const nextMax = season.teams.reduce(
    (maximum, team) => Math.max(maximum, team.draftOrderPosition),
    0,
  );
  const offset = currentMax + nextMax + season.teams.length + 1;
  await client.query(`
UPDATE fantasy_teams
SET display_order = display_order + $2,
    updated_at = $3
WHERE league_season_id = $1;
`.trim(), [season.id, offset, now]);
};

const upsertTeam = async (
  client: PostgresQueryClient,
  season: LeagueSeason,
  team: FantasyTeam,
  membershipOwnerUserId: string | null,
  preserveTeamClaims: boolean,
  now: Date,
): Promise<void> => {
  await client.query(`
INSERT INTO fantasy_teams (
  id, league_season_id, team_key, team_name, owner_name, abbreviation,
  manager_names_json, owner_user_id, display_order, aliases_json, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, '[]'::jsonb, $10, $10)
ON CONFLICT (id) DO UPDATE SET
  league_season_id = EXCLUDED.league_season_id,
  team_key = EXCLUDED.team_key,
  team_name = EXCLUDED.team_name,
  owner_name = EXCLUDED.owner_name,
  abbreviation = EXCLUDED.abbreviation,
  manager_names_json = EXCLUDED.manager_names_json,
  owner_user_id = ${preserveTeamClaims ? "fantasy_teams.owner_user_id" : "EXCLUDED.owner_user_id"},
  display_order = EXCLUDED.display_order,
  updated_at = EXCLUDED.updated_at;
`.trim(), [
    team.id,
    season.id,
    team.ownerId,
    team.displayName,
    team.ownerDisplayName,
    team.abbreviation ?? null,
    jsonbParameter(team.managerDisplayNames ?? []),
    preserveTeamClaims ? null : membershipOwnerUserId,
    team.draftOrderPosition,
    now,
  ]);
};

export const replaceTeams = async (
  client: PostgresQueryClient,
  season: LeagueSeason,
  memberships: readonly PlatformLeagueMembership[],
  preserveTeamClaims: boolean,
  now: Date,
): Promise<void> => {
  await shiftExistingTeamDisplayOrders(client, season, now);
  for (const team of season.teams) {
    const ownerUserId = teamOwnerUserIdFor(team, season.leagueId, memberships);
    await upsertTeam(client, season, team, ownerUserId, preserveTeamClaims, now);
  }
  await client.query(`
DELETE FROM fantasy_teams
WHERE league_season_id = $1 AND NOT (id = ANY($2::text[]));
`.trim(), [season.id, season.teams.map(team => team.id)]);
};
