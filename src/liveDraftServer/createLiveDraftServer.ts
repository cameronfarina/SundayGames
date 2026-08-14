import http from "node:http";
import { keepers } from "../../config/keepers.js";
import { defaultDraftRoomRankingPath, loadDraftRoomRankings } from "../data/draftRoomRankings.js";
import { loadHistoricalAuctionRecords } from "../data/parseHistoricalBoards.js";
import { MockBatchResourceManager } from "../mockBatchResourceManager.js";
import { buildPricingConfigFromSources } from "../pricingConfig.js";
import { loadCurrentProjections } from "../projections.js";
import { createBatchService } from "./batchService.js";
import {
  defaultCompletedMockBatchJobTtlMs,
  defaultLiveDraftImportBodyLimitBytes,
  defaultLiveDraftJsonBodyLimitBytes,
  defaultLiveDraftSessionDirectory,
  defaultLiveDraftSessionKey,
  defaultMaxCompletedMockBatchJobs,
  projectionPath,
  scratchSessionPrefix,
} from "./constants.js";
import type { CreateLiveDraftServerOptions, LiveDraftServerApp } from "./contracts.js";
import { positiveIntegerOption, ScratchSessionsDisabledError } from "./http.js";
import { defaultSleeperSyncPreviewProvider } from "./integrations/sleeper.js";
import { createInteractiveMockService } from "./interactiveMockService.js";
import { handleRequest } from "./requestHandler.js";
import type { LiveDraftData, RouteContext } from "./runtimeContracts.js";
import { draftSessionKeyFromBody, draftSessionKeyFromQuery } from "./sessionInput.js";
import { createStateService } from "./stateService.js";
import { createStoreService } from "./storeService.js";

const loadData = async (options: CreateLiveDraftServerOptions): Promise<LiveDraftData> => ({
  projections: options.projections ?? await loadCurrentProjections({ projectionPath }),
  historicalRecords: options.historicalRecords ?? await loadHistoricalAuctionRecords(),
  draftRoomRankings: options.draftRoomRankings ?? await loadDraftRoomRankings(defaultDraftRoomRankingPath),
  pricingConfig: options.pricingConfig ?? await buildPricingConfigFromSources(),
  configuredKeepers: options.keepers ?? keepers,
});

export const createLiveDraftServer = async (
  providedOptions: CreateLiveDraftServerOptions = {},
): Promise<LiveDraftServerApp> => {
  const options: CreateLiveDraftServerOptions = {
    ...providedOptions,
    sleeperSyncPreviewProvider: providedOptions.sleeperSyncPreviewProvider ?? defaultSleeperSyncPreviewProvider,
  };
  const data = await loadData(options);
  const scratchSessionsEnabled = options.scratchSessionsEnabled ?? false;
  const assertSessionEnabled = (sessionKey: string): void => {
    if (!scratchSessionsEnabled && sessionKey.startsWith(scratchSessionPrefix)) {
      throw new ScratchSessionsDisabledError();
    }
  };
  const stores = await createStoreService({
    baseDirectory: options.sessionDirectory ?? defaultLiveDraftSessionDirectory,
    scratchSessionsEnabled,
    initialSessionKey: defaultLiveDraftSessionKey,
  });
  const batches = createBatchService({
    options,
    data,
    now: options.mockBatchNow ?? (() => new Date()),
    completedJobTtlMs: positiveIntegerOption(
      options.completedMockBatchJobTtlMs,
      defaultCompletedMockBatchJobTtlMs,
      "completedMockBatchJobTtlMs",
    ),
    maxCompletedJobs: positiveIntegerOption(
      options.maxCompletedMockBatchJobs,
      defaultMaxCompletedMockBatchJobs,
      "maxCompletedMockBatchJobs",
    ),
    resourceManager: options.mockBatchResourceManager ?? new MockBatchResourceManager(),
  });
  const enabledDraftSessionKeyFromQuery = (url: URL, fallback?: string): string => {
    const key = draftSessionKeyFromQuery(url, fallback);
    assertSessionEnabled(key);
    return key;
  };
  const enabledDraftSessionKeyFromBody = (
    body: Record<string, unknown>,
    fallback?: string,
  ): string => {
    const key = draftSessionKeyFromBody(body, fallback);
    assertSessionEnabled(key);
    return key;
  };
  const state = createStateService({ data, options, stores, batches, enabledDraftSessionKeyFromQuery });
  const interactive = createInteractiveMockService({ data, options, stores, state, batches });
  const maxBodyBytes = positiveIntegerOption(
    options.maxBodyBytes,
    defaultLiveDraftJsonBodyLimitBytes,
    "maxBodyBytes",
  );
  const importMaxBodyBytes = positiveIntegerOption(
    options.importMaxBodyBytes,
    defaultLiveDraftImportBodyLimitBytes,
    "importMaxBodyBytes",
  );
  const context: RouteContext = {
    options,
    data,
    stores,
    state,
    interactive,
    batches,
    maxBodyBytes,
    importMaxBodyBytes,
    legacyMockBatchEnabled: options.legacyMockBatchEnabled ?? false,
    enabledDraftSessionKeyFromQuery,
    enabledDraftSessionKeyFromBody,
    bodyLimitForPath: pathname => pathname === "/api/import" ? importMaxBodyBytes : maxBodyBytes,
  };
  const server = http.createServer((request, response) => handleRequest(request, response, context));
  return { canDispose: batches.canDispose, server };
};
