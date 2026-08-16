import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { optionalNumber, stringValue } from "../request/values.js";
import { knownError, methodNotAllowed, notFound } from "../responses.js";
import { historicalDraftSetupFor } from "./season/historicalSetup.js";
import {
  currentLeaguePricingModelVersion,
  playerCatalogWithPricingSnapshot,
  rebuildPricingAfterKeeperChange,
  synchronizeUnopenedLiveRoomAfterKeeperChange,
} from "./season/pricingOrchestration.js";

export const routeHistoricalImports = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, batchId, action] = request.segments;
  if (request.segments.length !== 3 || action !== "commit") return notFound();
  if (request.method !== "POST") return methodNotAllowed();
  const seasonId = stringValue(request.body.seasonId).trim();
  const historicalSeasonYear = optionalNumber(request.body.seasonYear) ?? Number.NaN;
  if (seasonId.length === 0 || !Number.isInteger(historicalSeasonYear)) {
    return knownError(
      400,
      "historical_import_target_required",
      "Choose the league season and historical draft year before importing.",
    );
  }
  const season = await app.getLeagueSeason({ actorSessionToken: request.sessionToken, seasonId, now: request.now });
  if (await app.hasStartedLiveDraftRoomForSeason(season.id)) {
    return knownError(409, "historical_import_locked", "Draft history is locked after the live draft starts.");
  }
  const setup = season.settings.draftFormat === "auction"
    ? await historicalDraftSetupFor(season, services, request.now ?? new Date()) : null;
  const prepared = await app.prepareHistoricalImportCommit({
    actorSessionToken: request.sessionToken,
    batchId: batchId ?? "",
    expectedLeagueId: season.leagueId,
    expectedLeagueSeasonId: season.id,
    expectedSeasonYear: historicalSeasonYear,
    pricingSeasonYear: season.seasonYear,
    now: request.now,
  });
  if (season.settings.draftFormat !== "snake" && setup !== null) {
    await rebuildPricingAfterKeeperChange(app, request, season, setup, {
      preflight: true,
      historicalSaleRecords: prepared.projectedHistoricalSaleRecords,
      modelVersion: currentLeaguePricingModelVersion,
    });
  }
  const result = await app.commitHistoricalImport({
    actorSessionToken: request.sessionToken,
    batchId: batchId ?? "",
    expectedLeagueId: season.leagueId,
    expectedLeagueSeasonId: season.id,
    expectedSeasonYear: historicalSeasonYear,
    now: request.now,
  });
  if (season.settings.draftFormat !== "snake" && setup !== null) {
    const pricingResult = await rebuildPricingAfterKeeperChange(app, request, season, setup, {
      modelVersion: currentLeaguePricingModelVersion,
    });
    if (pricingResult === undefined || !("savedSnapshotIds" in pricingResult)) {
      throw new Error("Historical pricing rebuild did not persist a snapshot.");
    }
    const room = await synchronizeUnopenedLiveRoomAfterKeeperChange(
      app,
      request,
      season,
      setup,
      playerCatalogWithPricingSnapshot(setup.playerCatalog, pricingResult.snapshots.at(-1)),
      `history:${result.batch.id}:${pricingResult.modelRunId}`,
    );
    return {
      status: 200,
      body: { ...result, pricing: pricingResult, ...(room === null ? {} : { room }) },
    };
  }
  return { status: 200, body: result };
};
