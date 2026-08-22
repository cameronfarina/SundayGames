import { requireRequestAccount } from "../http/auth/access.js";
import { secretMatches } from "../http/auth/policy.js";
import type { PlatformApp, PlatformHttpResponse } from "../http/contracts.js";
import type { ParsedPlatformHttpRequest } from "../http/request/parsedRequest.js";
import { headerValue } from "../http/request/values.js";
import { knownError, methodNotAllowed, notFound } from "../http/responses.js";
import { buildPlatformDraftSchedule, platformDraftQueryWindow } from "./summary.js";
import type { PlatformDraftOperationsRepository } from "./contracts.js";
import {
  discordDraftDigestPayload,
  type DiscordDraftDigestPoster,
} from "./digest.js";

export interface PlatformDraftOperationsRouteServices {
  administratorAccountIds: ReadonlySet<string>;
  repository: PlatformDraftOperationsRepository;
  timezone: string;
  digest?: {
    triggerToken: string;
    postDiscord: DiscordDraftDigestPoster;
  } | undefined;
}

const scheduleFor = async (
  services: PlatformDraftOperationsRouteServices,
  now: Date,
) => {
  const window = platformDraftQueryWindow(now, services.timezone);
  const records = await services.repository.listScheduledDrafts(window);
  return buildPlatformDraftSchedule(records, { now, timezone: services.timezone });
};

const routeSchedule = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformDraftOperationsRouteServices,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET") return methodNotAllowed();
  const account = await requireRequestAccount(app, request);
  if (!services.administratorAccountIds.has(account.id)) {
    return knownError(
      403,
      "platform_admin_required",
      "Platform administrator access is required.",
    );
  }
  return { status: 200, body: await scheduleFor(services, request.now ?? new Date()) };
};

const routeDigest = async (
  request: ParsedPlatformHttpRequest,
  services: PlatformDraftOperationsRouteServices,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  if (services.digest === undefined) {
    return knownError(503, "draft_digest_unavailable", "Draft digest delivery is not configured.");
  }
  const token = headerValue(request.headers, "x-sundaygames-draft-digest-token");
  if (!secretMatches(services.digest.triggerToken, token)) {
    return knownError(403, "draft_digest_forbidden", "Draft digest trigger access was denied.");
  }
  const schedule = await scheduleFor(services, request.now ?? new Date());
  await services.digest.postDiscord(discordDraftDigestPayload(schedule));
  return { status: 204, body: null };
};

export const routePlatformDraftOperations = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformDraftOperationsRouteServices,
): Promise<PlatformHttpResponse> => {
  const [root, namespace, resource] = request.segments;
  if (root === "api" && namespace === "platform-admin" && resource === "drafts"
    && request.segments.length === 3) {
    return await routeSchedule(app, request, services);
  }
  if (root === "platform-admin" && namespace === "draft-digest"
    && request.segments.length === 2) {
    return await routeDigest(request, services);
  }
  return notFound();
};
