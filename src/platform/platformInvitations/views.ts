import type {
  PlatformInvitationRecord,
  PlatformInvitationView,
  PlatformLeagueInvitationRecord,
  PlatformLeagueInvitationView,
} from "./contracts.js";
import {
  derivePlatformLeagueInvitationToken,
  hashPlatformInvitationToken,
} from "./tokens.js";

export const publicInvitation = (
  record: PlatformInvitationRecord,
  token?: string,
): PlatformInvitationView => {
  const base = {
    id: record.id,
    leagueId: record.leagueId,
    seasonId: record.seasonId,
    kind: record.kind,
    role: record.role,
    status: record.status,
    expiresAt: record.expiresAt.toISOString(),
    ...(token === undefined
      ? {}
      : { acceptPath: `/invite?${new URLSearchParams({ token }).toString()}` }),
    reissuePath: `/invitations/${encodeURIComponent(record.id)}/reissue`,
    revokePath: `/invitations/${encodeURIComponent(record.id)}/revoke`,
  };
  return record.kind === "league"
    ? { ...base, kind: "league" }
    : {
      ...base,
      kind: "team",
      email: record.email,
      ownerDisplayName: record.ownerDisplayName,
      teamDisplayName: record.teamDisplayName,
    };
};

export const publicLeagueInvitation = (
  record: PlatformLeagueInvitationRecord,
  secret: string,
): PlatformLeagueInvitationView => {
  const token = derivePlatformLeagueInvitationToken(record.id, secret);
  if (hashPlatformInvitationToken(token) !== record.tokenHash) {
    throw new Error("League invitation token could not be reconstructed.");
  }
  const view = publicInvitation(record, token);
  if (view.kind !== "league") throw new Error("League invitation changed kind.");
  return view;
};
