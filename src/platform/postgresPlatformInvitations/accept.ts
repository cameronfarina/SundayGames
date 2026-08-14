import type { PlatformInvitationRecord } from "../platformInvitations.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { PlatformInvitationPostgresRow } from "./contracts.js";
import { invitationForRow } from "./rowCodec.js";

const acceptInvitationRow = async (
  client: PostgresQueryClient,
  invitationId: string,
  accountId: string,
  acceptedAt: Date,
): Promise<PlatformInvitationPostgresRow | undefined> => {
  const result = await client.query<PlatformInvitationPostgresRow>(`
UPDATE league_invitations
SET status = 'accepted', accepted_by_user_id = $2, accepted_at = $3, updated_at = $3
WHERE id = $1
  AND invitation_kind = 'team'
  AND status = 'pending'
  AND expires_at >= $3
RETURNING *;
`.trim(), [invitationId, accountId, acceptedAt]);
  return result.rows[0];
};

const activateMembership = async (
  client: PostgresQueryClient,
  row: PlatformInvitationPostgresRow,
  accountId: string,
  acceptedAt: Date,
  membershipId: string,
): Promise<void> => {
  await client.query(`
INSERT INTO league_memberships (id, league_id, user_id, role, status, created_at, updated_at)
VALUES ($1, $2, $3, $4, 'active', $5, $5)
ON CONFLICT (league_id, user_id) DO UPDATE SET
  status = 'active',
  updated_at = EXCLUDED.updated_at
RETURNING id;
`.trim(), [membershipId, row.league_id, accountId, row.role, acceptedAt]);
};

const claimTeam = async (
  client: PostgresQueryClient,
  row: PlatformInvitationPostgresRow,
  teamId: string,
  accountId: string,
  acceptedAt: Date,
): Promise<void> => {
  const result = await client.query<{ id: string }>(`
UPDATE fantasy_teams
SET owner_user_id = $3, updated_at = $4
WHERE id = $1
  AND league_season_id = $2
  AND (owner_user_id IS NULL OR owner_user_id = $3)
RETURNING id;
`.trim(), [teamId, row.season_id, accountId, acceptedAt]);
  if (result.rows[0] === undefined) {
    throw new Error("The invited team is already claimed by another account.");
  }
};

export const acceptInvitation = async (
  client: PostgresQueryClient,
  invitationId: string,
  accountId: string,
  acceptedAt: Date,
  membershipIdFactory: () => string,
): Promise<PlatformInvitationRecord | null> => {
  const row = await acceptInvitationRow(client, invitationId, accountId, acceptedAt);
  if (row === undefined) return null;
  if (row.team_id === null) throw new Error("Team invitation is missing its team.");
  await activateMembership(client, row, accountId, acceptedAt, membershipIdFactory());
  await claimTeam(client, row, row.team_id, accountId, acceptedAt);
  return invitationForRow(row);
};
