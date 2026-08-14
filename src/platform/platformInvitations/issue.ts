import { randomBytes } from "node:crypto";
import type {
  PlatformInvitationRepository,
  PlatformInvitationView,
  PlatformLeagueInvitationView,
} from "./contracts.js";
import type {
  IssuePlatformInvitationInput,
  IssuePlatformInvitationOptions,
  IssuePlatformLeagueInvitationInput,
} from "./operationContracts.js";
import { normalizedInvitationEmail } from "./records.js";
import {
  derivePlatformLeagueInvitationToken,
  hashPlatformInvitationToken,
} from "./tokens.js";
import { publicInvitation, publicLeagueInvitation } from "./views.js";

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
    email: normalizedInvitationEmail(input.email),
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

export const issuePlatformLeagueInvitation = async (
  repository: PlatformInvitationRepository,
  input: IssuePlatformLeagueInvitationInput,
  options: IssuePlatformInvitationOptions = {},
): Promise<PlatformLeagueInvitationView> => {
  const invitationId = options.idFactory?.() ??
    `invite_${randomBytes(24).toString("base64url")}`;
  if (options.leagueTokenSecret === undefined) {
    throw new Error("League invitation token secret is required.");
  }
  const token = derivePlatformLeagueInvitationToken(
    invitationId,
    options.leagueTokenSecret,
  );
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
