import type { PlatformInvitationRecord } from "../platformInvitations.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { insertPendingInvitation } from "./insert.js";
import { findPendingLeagueInvitationRow } from "./reads.js";
import { invitationForRow } from "./rowCodec.js";

const revokePendingInvitation = async (
  client: PostgresQueryClient,
  invitationId: string,
  replacedAt: Date,
): Promise<boolean> => {
  const result = await client.query<{ id: string }>(`
UPDATE league_invitations
SET status = 'revoked', revoked_at = $2, updated_at = $2
WHERE id = $1 AND status = 'pending'
RETURNING id;
`.trim(), [invitationId, replacedAt]);
  return result.rows[0] !== undefined;
};

const survivingLeagueInvitation = async (
  client: PostgresQueryClient,
  replacement: PlatformInvitationRecord,
): Promise<PlatformInvitationRecord | null> => {
  if (replacement.kind !== "league") return null;
  const row = await findPendingLeagueInvitationRow(client, replacement.seasonId);
  return row === undefined ? null : invitationForRow(row);
};

export const replacePendingInvitation = async (
  client: PostgresQueryClient,
  invitationId: string,
  replacement: PlatformInvitationRecord,
  replacedAt: Date,
): Promise<PlatformInvitationRecord | null> => {
  if (!await revokePendingInvitation(client, invitationId, replacedAt)) {
    return await survivingLeagueInvitation(client, replacement);
  }

  let row = await insertPendingInvitation(client, replacement);
  if (row === undefined && replacement.kind === "league") {
    row = await findPendingLeagueInvitationRow(client, replacement.seasonId);
  }
  if (row === undefined) throw new Error("Replacement invitation was not persisted.");
  return invitationForRow(row);
};
