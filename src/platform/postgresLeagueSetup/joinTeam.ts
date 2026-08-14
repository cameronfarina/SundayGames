import type {
  JoinLeagueSeasonTeamRepositoryInput,
  PlatformLeagueMembership,
} from "../leagueSetup.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { PlatformInvitationError } from "../platformInvitations.js";
import { TeamClaimUnavailableError, isTeamClaimUniqueViolation } from "./claimErrors.js";
import { firstRow, workspaceRoleFromDb } from "./databaseValues.js";
import { membershipIdFor } from "./identifiers.js";
import type { MembershipRow, TeamClaimRow } from "./rows.js";

const assertInvitationAvailable = async (
  client: PostgresQueryClient,
  input: JoinLeagueSeasonTeamRepositoryInput,
  now: Date,
): Promise<void> => {
  if (input.invitationTokenHash === undefined) return;
  const result = await client.query<{ id: string }>(`
SELECT id
FROM league_invitations
WHERE token_hash = $1
  AND invitation_kind = 'league'
  AND league_id = $2
  AND season_id = $3
  AND status = 'pending'
  AND expires_at >= $4
FOR UPDATE;
`.trim(), [input.invitationTokenHash, input.leagueId, input.seasonId, now]);
  if (firstRow(result) === undefined) {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }
};

const joinInsideTransaction = async (
  client: PostgresTransactionalQueryClient,
  input: JoinLeagueSeasonTeamRepositoryInput,
  now: Date,
): Promise<PlatformLeagueMembership | null> => await client.transaction(async transactionClient => {
  await assertInvitationAvailable(transactionClient, input, now);
  const existingClaim = await transactionClient.query<{ id: string }>(`
SELECT id
FROM fantasy_teams
WHERE league_season_id = $1
  AND owner_user_id = $2
  AND id <> $3
LIMIT 1;
`.trim(), [input.seasonId, input.userId, input.teamId]);
  if (firstRow(existingClaim) !== undefined) return null;

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

  const membershipResult = await transactionClient.query<MembershipRow>(`
INSERT INTO league_memberships (id, league_id, user_id, role, status, created_at, updated_at)
VALUES ($1, $2, $3, $4, 'active', $5, $5)
ON CONFLICT (league_id, user_id) DO UPDATE SET
  status = 'active',
  updated_at = EXCLUDED.updated_at
RETURNING id, league_id, user_id, role;
`.trim(), [membershipIdFor(input.leagueId, input.userId), input.leagueId, input.userId, input.role, now]);
  const membership = firstRow(membershipResult);
  if (membership === undefined) throw new Error("Joined league membership was not returned.");
  return {
    userId: membership.user_id,
    leagueId: membership.league_id,
    role: workspaceRoleFromDb(membership.role),
    ownerId: claim.owner_id,
    teamId: claim.team_id,
  };
});

export const joinLeagueSeasonTeam = async (
  client: PostgresTransactionalQueryClient,
  input: JoinLeagueSeasonTeamRepositoryInput,
): Promise<PlatformLeagueMembership | null> => {
  try {
    return await joinInsideTransaction(client, input, input.now ?? new Date());
  } catch (error) {
    if (error instanceof TeamClaimUnavailableError || isTeamClaimUniqueViolation(error)) return null;
    throw error;
  }
};
