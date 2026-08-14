import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { knownError, notFound } from "../../responses.js";
import { routeInvitationAccept } from "./accept.js";
import { routeInvitationClaim } from "./claim.js";
import { routeInvitationCollection } from "./collection.js";
import { routeInvitationDetails } from "./details.js";
import { routeInvitationManagement } from "./manage.js";

const developmentInvitationTokenSecret = "mockd-local-development-invitation-secret";

export const routeInvitations = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const repository = services.invitationRepository;
  if (repository === undefined) {
    return knownError(503, "invitations_unavailable", "League invitations are not configured.");
  }
  const tokenSecret = services.invitationTokenSecret ?? developmentInvitationTokenSecret;
  const [, invitationId, action] = request.segments;
  if (invitationId === "details" && request.segments.length === 2) {
    return await routeInvitationDetails(request, repository, services.leagueSetupRepository);
  }
  if (invitationId === "claim" && request.segments.length === 2) {
    return await routeInvitationClaim(
      app,
      request,
      services,
      repository,
      services.leagueSetupRepository,
    );
  }
  if (request.segments.length === 1) {
    return await routeInvitationCollection(app, request, repository, tokenSecret);
  }
  if (invitationId === "accept" && request.segments.length === 2) {
    return await routeInvitationAccept(app, request, services, repository);
  }
  if (
    request.segments.length !== 3
    || invitationId === undefined
    || (action !== "reissue" && action !== "revoke")
  ) {
    return notFound();
  }
  return await routeInvitationManagement(
    app,
    request,
    repository,
    invitationId,
    action,
    tokenSecret,
  );
};
