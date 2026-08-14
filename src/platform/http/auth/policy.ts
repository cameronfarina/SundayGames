import { timingSafeEqual } from "node:crypto";
import { normalizeEmail } from "../../auth.js";
import { hashPlatformInvitationToken } from "../../platformInvitations.js";
import type { PlatformHttpErrorBody, PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { headerValue, optionalString, stringValue } from "../request/values.js";
import { knownError } from "../responses.js";

const secretMatches = (expected: string | undefined, actual: string | undefined): boolean => {
  if (expected === undefined || actual === undefined || expected.length === 0 || actual.length === 0) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
};

export const hasProvisioningAccess = (
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): boolean => secretMatches(
  services.provisioningToken,
  headerValue(request.headers, "x-mockd-provisioning-token"),
);

export const accountCreationDenied = async (
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse<PlatformHttpErrorBody> | null> => {
  if (
    services.allowPublicSignup === true
    || hasProvisioningAccess(request, services)
    || (services.invitationRepository === undefined && services.provisioningToken === undefined)
  ) return null;
  const invitationToken = optionalString(request.body.invitationToken);
  const repository = services.invitationRepository;
  if (invitationToken === undefined || repository === undefined) {
    return knownError(403, "invitation_required", "Use the account link from your league invitation.");
  }
  const invitation = await repository.findByTokenHash(hashPlatformInvitationToken(invitationToken));
  const now = request.now ?? new Date();
  const email = normalizeEmail(stringValue(request.body.email));
  if (
    invitation === null
    || invitation.status !== "pending"
    || invitation.expiresAt < now
    || (invitation.kind === "team" && invitation.email !== email)
  ) return knownError(403, "invitation_required", "Use the account link from your league invitation.");
  return null;
};
