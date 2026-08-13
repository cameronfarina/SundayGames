import { createHash, createHmac, randomBytes } from "node:crypto";
import type { PlatformLeagueMembership } from "./leagueSetup.js";
import type { WorkspaceRole } from "./workspacePrivacy.js";

type MaybePromise<T> = T | Promise<T>;

export type PlatformInvitationStatus = "pending" | "accepted" | "revoked";
export type PlatformInvitationKind = "team" | "league";

interface PlatformInvitationRecordBase {
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

export type PlatformInvitationRecord = PlatformTeamInvitationRecord | PlatformLeagueInvitationRecord;

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

export type PlatformInvitationView = PlatformTeamInvitationView | PlatformLeagueInvitationView;

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
    if (invitation.kind === "league") {
      const pending = [...this.#records.values()].find(candidate =>
        candidate.kind === "league" &&
        candidate.seasonId === invitation.seasonId &&
        candidate.status === "pending"
      );
      if (pending !== undefined) return cloneRecord(pending);
    }
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
    if (record === undefined || record.kind !== "team" || record.status !== "pending") return null;

    const accepted: PlatformInvitationRecord = {
      ...record,
      status: "accepted",
      acceptedByUserId: accountId,
      acceptedAt: new Date(acceptedAt),
    };
    this.#records.set(invitationId, accepted);
    return cloneRecord(accepted);
  }

  replacePending(
    invitationId: string,
    replacement: PlatformInvitationRecord,
    replacedAt: Date,
  ): PlatformInvitationRecord | null {
    const current = this.#records.get(invitationId);
    if (current === undefined || current.status !== "pending") {
      if (replacement.kind !== "league") return null;
      const pending = [...this.#records.values()].find(candidate =>
        candidate.kind === "league" &&
        candidate.seasonId === replacement.seasonId &&
        candidate.status === "pending"
      );
      return pending === undefined ? null : cloneRecord(pending);
    }

    this.#records.set(invitationId, {
      ...current,
      status: "revoked",
      revokedAt: new Date(replacedAt),
    });
    const stored = cloneRecord(replacement);
    this.#records.set(stored.id, stored);
    return cloneRecord(stored);
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

export const derivePlatformLeagueInvitationToken = (
  invitationId: string,
  secret: string,
): string => {
  if (secret.length < 32) {
    throw new Error("League invitation token secret must be at least 32 characters.");
  }
  const signature = createHmac("sha256", secret).update(invitationId).digest("base64url");
  return `${invitationId}.${signature}`;
};

const publicInvitation = (
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

const publicLeagueInvitation = (
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

export const listPlatformInvitations = async (
  repository: PlatformInvitationRepository,
  seasonId: string,
  options: Pick<IssuePlatformInvitationOptions, "leagueTokenSecret"> = {},
): Promise<readonly PlatformInvitationView[]> =>
  (await repository.listForSeason(seasonId)).map(record => {
    const candidateToken = record.kind === "league" &&
        record.status === "pending" &&
        options.leagueTokenSecret !== undefined
      ? derivePlatformLeagueInvitationToken(record.id, options.leagueTokenSecret)
      : undefined;
    const token = candidateToken !== undefined &&
        hashPlatformInvitationToken(candidateToken) === record.tokenHash
      ? candidateToken
      : undefined;
    return publicInvitation(record, token);
  });

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
  leagueTokenSecret?: string;
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
    kind: "team",
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

export interface IssuePlatformLeagueInvitationInput {
  leagueId: string;
  seasonId: string;
  invitedByUserId: string;
  now: Date;
  expiresAt: Date;
}

export const issuePlatformLeagueInvitation = async (
  repository: PlatformInvitationRepository,
  input: IssuePlatformLeagueInvitationInput,
  options: IssuePlatformInvitationOptions = {},
): Promise<PlatformLeagueInvitationView> => {
  const invitationId = options.idFactory?.() ?? `invite_${randomBytes(24).toString("base64url")}`;
  if (options.leagueTokenSecret === undefined) {
    throw new Error("League invitation token secret is required.");
  }
  const token = derivePlatformLeagueInvitationToken(invitationId, options.leagueTokenSecret);
  const invitation = await repository.savePending({
    id: invitationId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    kind: "league",
    role: "member",
    invitedByUserId: input.invitedByUserId,
    tokenHash: hashPlatformInvitationToken(token),
    status: "pending",
    expiresAt: new Date(input.expiresAt),
    createdAt: new Date(input.now),
  });

  if (invitation.kind !== "league") {
    throw new Error("League invitation was persisted with the wrong kind.");
  }
  return publicLeagueInvitation(invitation, options.leagueTokenSecret);
};

export interface AcceptPlatformInvitationInput {
  token: string;
  account: { id: string; email: string };
  now: Date;
}

export interface AcceptedPlatformInvitation {
  invitation: PlatformTeamInvitationView;
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
  if (invitation.kind !== "team") {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "Choose a team from the league invitation page.",
    );
  }
  if (normalizedEmail(input.account.email) !== normalizedEmail(invitation.email)) {
    throw new PlatformInvitationError(
      "invitation_email_mismatch",
      "This invitation cannot be accepted by the signed-in account.",
    );
  }
  if (input.now.getTime() > invitation.expiresAt.getTime()) {
    throw new PlatformInvitationError(
      "invitation_expired",
      "This invitation has expired. Ask the commissioner for a new link.",
    );
  }

  const accepted = await repository.accept(invitation.id, input.account.id, input.now);
  if (accepted === null || accepted.kind !== "team") {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }

  const invitationView = publicInvitation(accepted);
  if (invitationView.kind !== "team") throw new Error("Accepted invitation changed kind.");
  return {
    invitation: invitationView,
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

export interface JoinedPlatformLeagueInvitation {
  invitation: PlatformLeagueInvitationView;
  membership: PlatformLeagueMembership;
}

export const joinPlatformLeagueInvitation = async (
  repository: PlatformInvitationRepository,
  input: AcceptPlatformInvitationInput,
): Promise<JoinedPlatformLeagueInvitation> => {
  const invitation = await repository.findByTokenHash(hashPlatformInvitationToken(input.token));
  if (invitation === null) {
    throw new PlatformInvitationError(
      "invitation_not_found",
      "This invitation link is invalid. Ask the commissioner for a new link.",
    );
  }
  if (invitation.kind !== "league" || invitation.status !== "pending") {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }
  if (input.now.getTime() > invitation.expiresAt.getTime()) {
    throw new PlatformInvitationError(
      "invitation_expired",
      "This invitation has expired. Ask the commissioner for a new link.",
    );
  }

  const invitationView = publicInvitation(invitation);
  if (invitationView.kind !== "league") throw new Error("Joined invitation changed kind.");
  return {
    invitation: invitationView,
    membership: {
      userId: input.account.id,
      leagueId: invitation.leagueId,
      role: invitation.role,
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
    if (current.kind === "league" && options.leagueTokenSecret !== undefined) {
      const pending = (await repository.listForSeason(current.seasonId)).find(candidate =>
        candidate.kind === "league" && candidate.status === "pending"
      );
      if (pending?.kind === "league") {
        return publicLeagueInvitation(pending, options.leagueTokenSecret);
      }
    }
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }

  const replacementId = options.idFactory?.() ?? `invite_${randomBytes(24).toString("base64url")}`;
  let token: string;
  if (current.kind === "league") {
    const secret = options.leagueTokenSecret;
    if (secret === undefined) {
      throw new Error("League invitation token secret is required.");
    }
    token = derivePlatformLeagueInvitationToken(replacementId, secret);
  } else {
    token = options.tokenFactory?.() ?? randomBytes(32).toString("base64url");
  }
  const replacement: PlatformInvitationRecord = current.kind === "league"
    ? {
        id: replacementId,
        leagueId: current.leagueId,
        seasonId: current.seasonId,
        kind: "league",
        role: current.role,
        invitedByUserId: input.invitedByUserId,
        tokenHash: hashPlatformInvitationToken(token),
        status: "pending",
        expiresAt: new Date(input.expiresAt),
        createdAt: new Date(input.now),
      }
    : {
        id: replacementId,
        leagueId: current.leagueId,
        seasonId: current.seasonId,
        kind: "team",
        email: current.email,
        role: current.role,
        ownerId: current.ownerId,
        teamId: current.teamId,
        ownerDisplayName: current.ownerDisplayName,
        teamDisplayName: current.teamDisplayName,
        invitedByUserId: input.invitedByUserId,
        tokenHash: hashPlatformInvitationToken(token),
        status: "pending",
        expiresAt: new Date(input.expiresAt),
        createdAt: new Date(input.now),
      };
  const saved = await repository.replacePending(current.id, replacement, input.now);
  if (saved === null) {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }
  if (saved.kind !== "league") return publicInvitation(saved, token);

  const secret = options.leagueTokenSecret;
  if (secret === undefined) throw new Error("League invitation token secret is required.");
  return publicLeagueInvitation(saved, secret);
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
