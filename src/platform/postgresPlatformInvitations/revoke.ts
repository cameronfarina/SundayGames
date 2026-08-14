import type { PlatformInvitationRecord } from "../platformInvitations.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { PlatformInvitationPostgresRow } from "./contracts.js";
import { invitationForRow } from "./rowCodec.js";

export const revokeInvitation = async (
  client: PostgresQueryClient,
  invitationId: string,
  revokedAt: Date,
): Promise<PlatformInvitationRecord | null> => {
  const result = await client.query<PlatformInvitationPostgresRow>(`
UPDATE league_invitations
SET status = 'revoked', revoked_at = $2, updated_at = $2
WHERE id = $1 AND status = 'pending'
RETURNING *;
`.trim(), [invitationId, revokedAt]);
  const row = result.rows[0];
  return row === undefined ? null : invitationForRow(row);
};
