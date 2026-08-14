import type {
  ClaimLeagueSeasonTeamRepositoryInput,
  PlatformLeagueMembership,
} from "../leagueSetup.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import { TeamClaimUnavailableError, isTeamClaimUniqueViolation } from "./claimErrors.js";
import { firstRow, workspaceRoleFromDb } from "./databaseValues.js";
import type { MembershipRow, TeamClaimRow } from "./rows.js";

const claimInsideTransaction = async (
  client: PostgresTransactionalQueryClient,
  input: ClaimLeagueSeasonTeamRepositoryInput,
  now: Date,
): Promise<PlatformLeagueMembership | null> => await client.transaction(async transactionClient => {
  const membershipResult = await transactionClient.query<MembershipRow>(`
SELECT id, league_id, user_id, role
FROM league_memberships
WHERE league_id = $1 AND user_id = $2 AND status = 'active'
LIMIT 1
`.trim(), [input.leagueId, input.userId]);
  const membership = firstRow(membershipResult);
  if (membership === undefined) return null;

  const targetTeamResult = await transactionClient.query<{ id: string }>(`
SELECT id
FROM fantasy_teams
WHERE league_season_id = $1 AND id = $2 AND team_key = $3
LIMIT 1
`.trim(), [input.seasonId, input.teamId, input.ownerId]);
  if (firstRow(targetTeamResult) === undefined) return null;

  await transactionClient.query(`
UPDATE fantasy_teams
SET owner_user_id = NULL,
    updated_at = $4
WHERE league_season_id = $1
  AND owner_user_id = $2
  AND id <> $3;
`.trim(), [input.seasonId, input.userId, input.teamId, now]);

  const claimedResult = await transactionClient.query<TeamClaimRow>(`
UPDATE fantasy_teams
SET owner_user_id = $4,
    updated_at = $5
WHERE league_season_id = $1
  AND id = $2
  AND team_key = $3
  AND (owner_user_id IS NULL OR owner_user_id = $4)
RETURNING owner_user_id, team_key AS owner_id, id AS team_id;
`.trim(), [input.seasonId, input.teamId, input.ownerId, input.userId, now]);
  const claim = firstRow(claimedResult);
  if (claim === undefined) throw new TeamClaimUnavailableError();
  return {
    userId: membership.user_id,
    leagueId: membership.league_id,
    role: workspaceRoleFromDb(membership.role),
    ownerId: claim.owner_id,
    teamId: claim.team_id,
  };
});

export const claimLeagueSeasonTeam = async (
  client: PostgresTransactionalQueryClient,
  input: ClaimLeagueSeasonTeamRepositoryInput,
): Promise<PlatformLeagueMembership | null> => {
  try {
    return await claimInsideTransaction(client, input, input.now ?? new Date());
  } catch (error) {
    if (error instanceof TeamClaimUnavailableError || isTeamClaimUniqueViolation(error)) return null;
    throw error;
  }
};
