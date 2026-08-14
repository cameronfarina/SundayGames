import { randomBytes } from "node:crypto";
import type {
  PlatformInvitationRecord,
  PlatformInvitationRepository,
  PlatformInvitationView,
} from "./contracts.js";
import { PlatformInvitationError } from "./contracts.js";
import type {
  IssuePlatformInvitationOptions,
  ReissuePlatformInvitationInput,
} from "./operationContracts.js";
import {
  derivePlatformLeagueInvitationToken,
  hashPlatformInvitationToken,
} from "./tokens.js";
import { publicInvitation, publicLeagueInvitation } from "./views.js";

const replacementRecord = (
  current: PlatformInvitationRecord,
  replacementId: string,
  token: string,
  input: ReissuePlatformInvitationInput,
): PlatformInvitationRecord => current.kind === "league"
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

const existingPendingLeagueView = async (
  repository: PlatformInvitationRepository,
  current: PlatformInvitationRecord,
  secret: string | undefined,
): Promise<PlatformInvitationView | undefined> => {
  if (current.kind !== "league" || secret === undefined) return undefined;
  const pending = (await repository.listForSeason(current.seasonId)).find(candidate =>
    candidate.kind === "league" && candidate.status === "pending");
  return pending?.kind === "league"
    ? publicLeagueInvitation(pending, secret)
    : undefined;
};

const leagueReplacementToken = (
  replacementId: string,
  secret: string | undefined,
): string => {
  if (secret === undefined) {
    throw new Error("League invitation token secret is required.");
  }
  return derivePlatformLeagueInvitationToken(replacementId, secret);
};

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
    const existing = await existingPendingLeagueView(
      repository,
      current,
      options.leagueTokenSecret,
    );
    if (existing !== undefined) return existing;
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }
  const replacementId = options.idFactory?.() ??
    `invite_${randomBytes(24).toString("base64url")}`;
  const token = current.kind === "league"
    ? leagueReplacementToken(replacementId, options.leagueTokenSecret)
    : options.tokenFactory?.() ?? randomBytes(32).toString("base64url");
  const saved = await repository.replacePending(
    current.id,
    replacementRecord(current, replacementId, token, input),
    input.now,
  );
  if (saved === null) {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }
  if (saved.kind !== "league") return publicInvitation(saved, token);
  if (options.leagueTokenSecret === undefined) {
    throw new Error("League invitation token secret is required.");
  }
  return publicLeagueInvitation(saved, options.leagueTokenSecret);
};
