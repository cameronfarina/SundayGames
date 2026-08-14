import type { PlatformInvitationRecord } from "../platformInvitations.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { insertPendingInvitation } from "./insert.js";
import { findPendingLeagueInvitationRow } from "./reads.js";
import { invitationForRow } from "./rowCodec.js";

export const savePendingInvitation = async (
  client: PostgresQueryClient,
  invitation: PlatformInvitationRecord,
): Promise<PlatformInvitationRecord> => {
  let row = await insertPendingInvitation(client, invitation);
  if (row === undefined && invitation.kind === "league") {
    row = await findPendingLeagueInvitationRow(client, invitation.seasonId);
  }
  if (row === undefined) throw new Error("Invitation was not persisted.");
  return invitationForRow(row);
};
