import { createHash, randomBytes } from "node:crypto";
import type { PlatformLeagueMembership } from "./leagueSetup.js";
import type { WorkspaceRole } from "./workspacePrivacy.js";

type MaybePromise<T> = T | Promise<T>;

export type PlatformInvitationStatus = "pending" | "accepted" | "revoked";

export interface PlatformInvitationRecord {
  id: string;
  leagueId: string;
  seasonId: string;
  email: string;
  role: WorkspaceRole;
  ownerId: string;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  invitedByUserId: string;
  tokenHash: string;
  status: PlatformInvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date;
  acceptedByUserId?: string;
  revokedAt?: Date;
}

export interface PlatformInvitationView {
  id: string;
  leagueId: string;
  seasonId: string;
  email: string;
  role: WorkspaceRole;
  ownerDisplayName: string;
  teamDisplayName: string;
  status: PlatformInvitationStatus;
  expiresAt: string;
  acceptPath?: string;
  reissuePath: string;
  revokePath: string;
}

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
  revoke(invitationId: string, revokedAt: Date): MaybePromise<PlatformInvitationRecord | null>;
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

const cloneRecord = (record: PlatformInvitationRecord): PlatformInvitationRecord => ({
  ...record,
  createdAt: new Date(record.createdAt),
  expiresAt: new Date(record.expiresAt),
  ...(record.acceptedAt === undefined ? {} : { acceptedAt: new Date(record.acceptedAt) }),
  ...(record.revokedAt === undefined ? {} : { revokedAt: new Date(record.revokedAt) }),
});

export class InMemoryPlatformInvitationRepository implements PlatformInvitationRepository {
  readonly #records = new Map<string, PlatformInvitationRecord>();

  savePending(invitation: PlatformInvitationRecord): PlatformInvitationRecord {
    const stored = cloneRecord(invitation);
    this.#records.set(stored.id, stored);
    return cloneRecord(stored);
  }

  findById(invitationId: string): PlatformInvitationRecord | null {
    const record = this.#records.get(invitationId);
    return record === undefined ? null : cloneRecord(record);
  }

  findByTokenHash(tokenHash: string): PlatformInvitationRecord | null {
    const record = [...this.#records.values()].find(candidate => candidate.tokenHash === tokenHash);
    return record === undefined ? null : cloneRecord(record);
  }

  listForSeason(seasonId: string): readonly PlatformInvitationRecord[] {
    return [...this.#records.values()]
      .filter(record => record.seasonId === seasonId)
      .map(cloneRecord);
  }

  accept(invitationId: string, accountId: string, acceptedAt: Date): PlatformInvitationRecord | null {
    const record = this.#records.get(invitationId);
    if (record === undefined || record.status !== "pending") return null;

    const accepted: PlatformInvitationRecord = {
      ...record,
      status: "accepted",
      acceptedByUserId: accountId,
      acceptedAt: new Date(acceptedAt),
    };
    this.#records.set(invitationId, accepted);
    return cloneRecord(accepted);
  }

  revoke(invitationId: string, revokedAt: Date): PlatformInvitationRecord | null {
    const record = this.#records.get(invitationId);
    if (record === undefined || record.status !== "pending") return null;

    const revoked: PlatformInvitationRecord = {
      ...record,
      status: "revoked",
      revokedAt: new Date(revokedAt),
    };
    this.#records.set(invitationId, revoked);
    return cloneRecord(revoked);
  }
}

export const hashPlatformInvitationToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const publicInvitation = (
  record: PlatformInvitationRecord,
  token?: string,
): PlatformInvitationView => ({
  id: record.id,
  leagueId: record.leagueId,
  seasonId: record.seasonId,
  email: record.email,
  role: record.role,
  ownerDisplayName: record.ownerDisplayName,
  teamDisplayName: record.teamDisplayName,
  status: record.status,
  expiresAt: record.expiresAt.toISOString(),
  ...(token === undefined
    ? {}
    : { acceptPath: `/invite?${new URLSearchParams({ token }).toString()}` }),
  reissuePath: `/invitations/${encodeURIComponent(record.id)}/reissue`,
  revokePath: `/invitations/${encodeURIComponent(record.id)}/revoke`,
});

export const listPlatformInvitations = async (
  repository: PlatformInvitationRepository,
  seasonId: string,
): Promise<readonly PlatformInvitationView[]> =>
  (await repository.listForSeason(seasonId)).map(record => publicInvitation(record));

export interface IssuePlatformInvitationInput {
  leagueId: string;
  seasonId: string;
  email: string;
  role: WorkspaceRole;
  ownerId: string;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  invitedByUserId: string;
  now: Date;
  expiresAt: Date;
}

export interface IssuePlatformInvitationOptions {
  idFactory?: () => string;
  tokenFactory?: () => string;
}

const normalizedEmail = (email: string): string => email.trim().toLowerCase();

export const issuePlatformInvitation = async (
  repository: PlatformInvitationRepository,
  input: IssuePlatformInvitationInput,
  options: IssuePlatformInvitationOptions = {},
): Promise<PlatformInvitationView> => {
  const token = options.tokenFactory?.() ?? randomBytes(32).toString("base64url");
  const invitation = await repository.savePending({
    id: options.idFactory?.() ?? `invite_${randomBytes(12).toString("base64url")}`,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    email: normalizedEmail(input.email),
    role: input.role,
    ownerId: input.ownerId,
    teamId: input.teamId,
    ownerDisplayName: input.ownerDisplayName,
    teamDisplayName: input.teamDisplayName,
    invitedByUserId: input.invitedByUserId,
    tokenHash: hashPlatformInvitationToken(token),
    status: "pending",
    expiresAt: new Date(input.expiresAt),
    createdAt: new Date(input.now),
  });

  return publicInvitation(invitation, token);
};

export interface AcceptPlatformInvitationInput {
  token: string;
  account: { id: string; email: string };
  now: Date;
}

export interface AcceptedPlatformInvitation {
  invitation: PlatformInvitationView;
  membership: PlatformLeagueMembership;
}

export const acceptPlatformInvitation = async (
  repository: PlatformInvitationRepository,
  input: AcceptPlatformInvitationInput,
): Promise<AcceptedPlatformInvitation> => {
  const invitation = await repository.findByTokenHash(hashPlatformInvitationToken(input.token));
  if (invitation === null) {
    throw new PlatformInvitationError(
      "invitation_not_found",
      "This invitation link is invalid. Ask the commissioner for a new link.",
    );
  }
  if (invitation.status !== "pending") {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }
  if (normalizedEmail(input.account.email) !== normalizedEmail(invitation.email)) {
    throw new PlatformInvitationError(
      "invitation_email_mismatch",
      `Sign in with ${invitation.email} to accept this invitation.`,
    );
  }
  if (input.now.getTime() > invitation.expiresAt.getTime()) {
    throw new PlatformInvitationError(
      "invitation_expired",
      "This invitation has expired. Ask the commissioner for a new link.",
    );
  }

  const accepted = await repository.accept(invitation.id, input.account.id, input.now);
  if (accepted === null) {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }

  return {
    invitation: publicInvitation(accepted),
    membership: {
      userId: input.account.id,
      leagueId: accepted.leagueId,
      role: accepted.role,
      ownerId: accepted.ownerId,
      teamId: accepted.teamId,
      inviteEmail: accepted.email,
    },
  };
};

export interface ReissuePlatformInvitationInput {
  invitationId: string;
  invitedByUserId: string;
  now: Date;
  expiresAt: Date;
}

export const reissuePlatformInvitation = async (
  repository: PlatformInvitationRepository,
  input: ReissuePlatformInvitationInput,
  options: IssuePlatformInvitationOptions = {},
): Promise<PlatformInvitationView> => {
  const current = await repository.findById(input.invitationId);
  if (current === null) {
    throw new PlatformInvitationError(
      "invitation_not_found",
      "This invitation could not be found.",
    );
  }
  if (current.status !== "pending") {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }

  const revoked = await repository.revoke(current.id, input.now);
  if (revoked === null) {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }

  return issuePlatformInvitation(repository, {
    leagueId: current.leagueId,
    seasonId: current.seasonId,
    email: current.email,
    role: current.role,
    ownerId: current.ownerId,
    teamId: current.teamId,
    ownerDisplayName: current.ownerDisplayName,
    teamDisplayName: current.teamDisplayName,
    invitedByUserId: input.invitedByUserId,
    now: input.now,
    expiresAt: input.expiresAt,
  }, options);
};

export const revokePlatformInvitation = async (
  repository: PlatformInvitationRepository,
  invitationId: string,
  revokedAt: Date,
): Promise<PlatformInvitationView> => {
  const revoked = await repository.revoke(invitationId, revokedAt);
  if (revoked === null) {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }

  return publicInvitation(revoked);
};
