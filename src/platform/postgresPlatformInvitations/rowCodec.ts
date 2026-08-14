import type { PlatformInvitationRecord } from "../platformInvitations.js";
import type { PlatformInvitationPostgresRow } from "./contracts.js";

const copyDate = (value: Date | string): Date => new Date(value);

export const invitationForRow = (
  row: PlatformInvitationPostgresRow,
): PlatformInvitationRecord => {
  const base = {
    id: row.id,
    leagueId: row.league_id,
    seasonId: row.season_id,
    role: row.role,
    invitedByUserId: row.invited_by_user_id,
    tokenHash: row.token_hash,
    status: row.status,
    expiresAt: copyDate(row.expires_at),
    createdAt: copyDate(row.created_at),
    ...(row.accepted_at === null ? {} : { acceptedAt: copyDate(row.accepted_at) }),
    ...(row.accepted_by_user_id === null ? {} : { acceptedByUserId: row.accepted_by_user_id }),
    ...(row.revoked_at === undefined || row.revoked_at === null
      ? {}
      : { revokedAt: copyDate(row.revoked_at) }),
  };

  if (row.invitation_kind === "league") return { ...base, kind: "league" };
  if (
    row.email_normalized === null
    || row.owner_id === null
    || row.team_id === null
    || row.owner_display_name === null
    || row.team_display_name === null
  ) {
    throw new Error("Team invitation is missing its team-specific fields.");
  }

  return {
    ...base,
    kind: "team",
    email: row.email_normalized,
    ownerId: row.owner_id,
    teamId: row.team_id,
    ownerDisplayName: row.owner_display_name,
    teamDisplayName: row.team_display_name,
  };
};
