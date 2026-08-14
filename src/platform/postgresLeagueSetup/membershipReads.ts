import type { PlatformLeagueMembership } from "../leagueSetup.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { workspaceRoleFromDb } from "./databaseValues.js";
import type { MembershipRow, TeamClaimRow } from "./rows.js";

const teamClaimsForLeague = async (
  client: PostgresQueryClient,
  leagueId: string,
): Promise<ReadonlyMap<string, { ownerId: string; teamId: string }>> => {
  const result = await client.query<TeamClaimRow>(`
WITH latest_season AS (
  SELECT id
  FROM league_seasons
  WHERE league_id = $1
  ORDER BY season_year DESC, updated_at DESC, id DESC
  LIMIT 1
)
SELECT
  ft.owner_user_id,
  ft.team_key AS owner_id,
  ft.id AS team_id
FROM fantasy_teams ft
JOIN latest_season s ON s.id = ft.league_season_id
WHERE ft.owner_user_id IS NOT NULL
ORDER BY ft.display_order ASC, ft.id ASC
`.trim(), [leagueId]);
  const claims = new Map<string, { ownerId: string; teamId: string }>();
  for (const row of result.rows) {
    if (!claims.has(row.owner_user_id)) {
      claims.set(row.owner_user_id, { ownerId: row.owner_id, teamId: row.team_id });
    }
  }
  return claims;
};

export const membershipsForLeague = async (
  client: PostgresQueryClient,
  leagueId: string,
): Promise<readonly PlatformLeagueMembership[]> => {
  const result = await client.query<MembershipRow>(`
SELECT id, league_id, user_id, role
FROM league_memberships
WHERE league_id = $1 AND status = 'active'
ORDER BY created_at ASC, id ASC
`.trim(), [leagueId]);
  const claims = await teamClaimsForLeague(client, leagueId);
  return result.rows.map(row => {
    const claim = claims.get(row.user_id);
    return {
      userId: row.user_id,
      leagueId: row.league_id,
      role: workspaceRoleFromDb(row.role),
      ...(claim === undefined ? {} : { ownerId: claim.ownerId, teamId: claim.teamId }),
    };
  });
};

export const findMembership = async (
  client: PostgresQueryClient,
  userId: string,
  leagueId: string,
): Promise<PlatformLeagueMembership | null> => {
  const memberships = await membershipsForLeague(client, leagueId);
  return memberships.find(membership => membership.userId === userId) ?? null;
};
