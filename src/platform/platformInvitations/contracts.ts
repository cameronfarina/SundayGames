import type { WorkspaceRole } from "../workspacePrivacy.js";

export type MaybePromise<Value> = Value | Promise<Value>;
export type PlatformInvitationStatus = "pending" | "accepted" | "revoked";
export type PlatformInvitationKind = "team" | "league";

export interface PlatformInvitationRecordBase {
  id: string;
  leagueId: string;
  seasonId: string;
  kind: PlatformInvitationKind;
  role: WorkspaceRole;
  invitedByUserId: string;
  tokenHash: string;
  status: PlatformInvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date;
  acceptedByUserId?: string;
  revokedAt?: Date;
}

export interface PlatformTeamInvitationRecord extends PlatformInvitationRecordBase {
  kind: "team";
  email: string;
  ownerId: string;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
}

export interface PlatformLeagueInvitationRecord extends PlatformInvitationRecordBase {
  kind: "league";
}

export type PlatformInvitationRecord =
  | PlatformTeamInvitationRecord
  | PlatformLeagueInvitationRecord;

interface PlatformInvitationViewBase {
  id: string;
  leagueId: string;
  seasonId: string;
  kind: PlatformInvitationKind;
  role: WorkspaceRole;
  status: PlatformInvitationStatus;
  expiresAt: string;
  acceptPath?: string;
  reissuePath: string;
  revokePath: string;
}

export interface PlatformTeamInvitationView extends PlatformInvitationViewBase {
  kind: "team";
  email: string;
  ownerDisplayName: string;
  teamDisplayName: string;
}

export interface PlatformLeagueInvitationView extends PlatformInvitationViewBase {
  kind: "league";
}

export type PlatformInvitationView =
  | PlatformTeamInvitationView
  | PlatformLeagueInvitationView;

export interface PlatformInvitationRepository {
  savePending(invitation: PlatformInvitationRecord): MaybePromise<PlatformInvitationRecord>;
  findById(invitationId: string): MaybePromise<PlatformInvitationRecord | null>;
  findByTokenHash(tokenHash: string): MaybePromise<PlatformInvitationRecord | null>;
  listForSeason(seasonId: string): MaybePromise<readonly PlatformInvitationRecord[]>;
  accept(
    invitationId: string,
    accountId: string,
    acceptedAt: Date,
  ): MaybePromise<PlatformInvitationRecord | null>;
  replacePending(
    invitationId: string,
    replacement: PlatformInvitationRecord,
    replacedAt: Date,
  ): MaybePromise<PlatformInvitationRecord | null>;
  revoke(
    invitationId: string,
    revokedAt: Date,
  ): MaybePromise<PlatformInvitationRecord | null>;
}

export type PlatformInvitationErrorCode =
  | "invitation_not_found"
  | "invitation_unavailable"
  | "invitation_email_mismatch"
  | "invitation_expired";

export class PlatformInvitationError extends Error {
  readonly code: PlatformInvitationErrorCode;

  constructor(code: PlatformInvitationErrorCode, message: string) {
    super(message);
    this.name = "PlatformInvitationError";
    this.code = code;
  }
}
