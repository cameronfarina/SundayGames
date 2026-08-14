import type { PlatformInvitationRecord } from "../platformInvitations.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { PlatformInvitationPostgresRow } from "./contracts.js";

const insertInvitationSql = `
INSERT INTO league_invitations (
  id, league_id, season_id, invitation_kind, email_normalized, role, owner_id, team_id,
  owner_display_name, team_display_name, invited_by_user_id, token_hash,
  status, expires_at, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, $14, $14)
ON CONFLICT (season_id) WHERE status = 'pending' AND invitation_kind = 'league'
DO NOTHING
RETURNING *;
`.trim();

const invitationParameters = (
  invitation: PlatformInvitationRecord,
): readonly unknown[] => [
  invitation.id,
  invitation.leagueId,
  invitation.seasonId,
  invitation.kind,
  invitation.kind === "team" ? invitation.email : null,
  invitation.role,
  invitation.kind === "team" ? invitation.ownerId : null,
  invitation.kind === "team" ? invitation.teamId : null,
  invitation.kind === "team" ? invitation.ownerDisplayName : null,
  invitation.kind === "team" ? invitation.teamDisplayName : null,
  invitation.invitedByUserId,
  invitation.tokenHash,
  invitation.expiresAt,
  invitation.createdAt,
];

export const insertPendingInvitation = async (
  client: PostgresQueryClient,
  invitation: PlatformInvitationRecord,
): Promise<PlatformInvitationPostgresRow | undefined> => {
  const result = await client.query<PlatformInvitationPostgresRow>(
    insertInvitationSql,
    invitationParameters(invitation),
  );
  return result.rows[0];
};
