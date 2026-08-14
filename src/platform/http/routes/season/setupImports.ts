import {
  analyzeLeagueMembersScreenshot,
  applyLeagueMembersScreenshotImport,
  applyLeagueSetupImport,
  previewLeagueSetupImport,
} from "../../../platformSetupHttp.js";
import type { PlatformLeagueSetupImportInput } from "../../../platformSetupHttp.js";
import { requireSeasonManager } from "../../auth/access.js";
import { screenshotRateLimitResponse } from "../../auth/rateLimits.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString, stringArrayValue } from "../../request/values.js";
import { knownError, methodNotAllowed, notFound } from "../../responses.js";
import { leagueMembersScreenshotImportInput, setupImportKnownUsers } from "./setupImportInputs.js";

export const routeSeasonSetupImport = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: Pick<PlatformHttpServices,
    "invitationRepository" | "leagueMembersScreenshotAnalyzer" | "screenshotImportRateLimiter">,
): Promise<PlatformHttpResponse> => {
  const [, seasonId, , action] = request.segments;
  if (request.segments.length !== 4) return notFound();
  if (request.method !== "POST") return methodNotAllowed();
  const content = optionalString(request.body.content);
  const input: PlatformLeagueSetupImportInput = {
    actorSessionToken: request.sessionToken,
    seasonId: seasonId ?? "",
    rows: stringArrayValue(request.body.rows),
    knownUsers: setupImportKnownUsers(request.body.knownUsers),
    ...(content === undefined ? {} : { content }),
    ...(request.now === undefined ? {} : { now: request.now }),
    ...(services.invitationRepository === undefined ? {} : { invitationRepository: services.invitationRepository }),
  };
  if (action === "preview") return await previewLeagueSetupImport(app, input);
  if (action === "apply") return await applyLeagueSetupImport(app, input);
  if (action === "screenshot-analyze") {
    const account = await requireSeasonManager(app, request, seasonId ?? "");
    const analyzer = services.leagueMembersScreenshotAnalyzer;
    if (analyzer === undefined) {
      return knownError(503, "screenshot_import_unavailable", "Screenshot import is not configured for this deployment.");
    }
    const limited = screenshotRateLimitResponse(
      request,
      services.screenshotImportRateLimiter,
      `${account.id}:${seasonId ?? ""}`,
    );
    if (limited !== null) return limited;
    return await analyzeLeagueMembersScreenshot(app, {
      actorSessionToken: request.sessionToken,
      seasonId: seasonId ?? "",
      image: {
        mimeType: optionalString(request.body.mimeType) ?? "",
        base64: optionalString(request.body.base64) ?? "",
      },
      analyzer,
      now: request.now,
    });
  }
  if (action === "screenshot-apply") {
    await requireSeasonManager(app, request, seasonId ?? "");
    const setupRevision = optionalString(request.body.setupRevision);
    return await applyLeagueMembersScreenshotImport(app, {
      actorSessionToken: request.sessionToken,
      seasonId: seasonId ?? "",
      ...(setupRevision === undefined ? {} : { setupRevision }),
      import: leagueMembersScreenshotImportInput(request.body),
      now: request.now,
    });
  }
  return notFound();
};
