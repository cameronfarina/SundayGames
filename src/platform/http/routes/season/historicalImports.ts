import { historicalSpreadsheetUploadToSourceText } from "../../../historicalSpreadsheetImport.js";
import { requireSeasonManager } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalBoolean, optionalNumber, optionalString, stringValue } from "../../request/values.js";
import { knownError, methodNotAllowed, notFound } from "../../responses.js";
import { historicalDraftSetupFor, historicalOwnerMappingsFrom, historicalPlayerMappingsFrom } from "./historicalSetup.js";

export const routeSeasonHistoricalImports = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, seasonId, , action] = request.segments;
  if (request.segments.length !== 4) return notFound();
  if (action !== "preview" && action !== "upload-preview") return notFound();
  if (request.method !== "POST") return methodNotAllowed();
  await requireSeasonManager(app, request, seasonId ?? "");
  const season = await app.getLeagueSeason({ actorSessionToken: request.sessionToken, seasonId: seasonId ?? "", now: request.now });
  if (await app.hasStartedLiveDraftRoomForSeason(season.id)) {
    return knownError(409, "historical_import_locked", "Draft history is locked after the live draft starts.");
  }
  const sourceText = action === "upload-preview"
    ? await historicalSpreadsheetUploadToSourceText({
        fileName: stringValue(request.body.fileName),
        mimeType: stringValue(request.body.mimeType),
        base64: stringValue(request.body.base64),
      })
    : optionalString(request.body.sourceText) ?? optionalString(request.body.content) ?? "";
  const historicalSetup = await historicalDraftSetupFor(season, services, request.now ?? new Date());
  const result = await app.previewHistoricalImportSource({
    actorSessionToken: request.sessionToken,
    leagueId: season.leagueId,
    seasonYear: optionalNumber(request.body.seasonYear) ?? season.seasonYear,
    currentSeasonId: season.id,
    sourceText,
    inferFirstRosterRowAsKeeper: optionalBoolean(request.body.inferFirstRosterRowAsKeeper),
    replacementRequested: optionalBoolean(request.body.replacementRequested),
    ...(historicalSetup === null ? {} : { playerCatalog: historicalSetup.playerCatalog }),
    ownerMappings: historicalOwnerMappingsFrom(request.body.ownerMappings),
    requireCompleteTeamMapping: optionalBoolean(request.body.requireCompleteTeamMapping),
    playerMappings: historicalPlayerMappingsFrom(request.body.playerMappings),
    now: request.now,
  });
  return { status: 200, body: result };
};
