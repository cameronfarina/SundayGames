import { createServer, type Server } from "node:http";
import type { PlatformDraftToolsAdapter } from "../platformDraftToolsAdapter.js";
import type { PlatformHttpHandler } from "../platformHttp.js";
import { createPlatformNodeHttpAdapter } from "../platformNodeHttp.js";
import { PlatformHttpActiveStreamRegistry } from "../platformNodeHttp/activeStreamRegistry.js";
import { platformFallbackHtml } from "../platformFallbackHtml.js";
import type { PlatformAdmissions } from "./admissions.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import { createGlobalPlayerNewsHandler } from "./globalPlayerNews.js";
import { createHistoricalImportPreflight } from "./historicalImportPreflight.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";
import { createScreenshotImportPreflight } from "./screenshotPreflight.js";
import { createSimulationCompletionPreflight } from "./simulationCompletionPreflight.js";

export interface PlatformNodeServer {
  server: Server;
  abortAndDrainActiveStreams(): Promise<void>;
}

export const createNodeServer = (
  handler: PlatformHttpHandler,
  draftToolsAdapter: PlatformDraftToolsAdapter,
  runtimeHolder: PlatformRuntimeHolder,
  options: CreatePlatformServerOptions,
  admissions: PlatformAdmissions,
): PlatformNodeServer => {
  const activeStreamRegistry = new PlatformHttpActiveStreamRegistry();
  const platformNodeHandler = createPlatformNodeHttpAdapter(handler, {
    appHtml: options.appHtml ?? platformFallbackHtml,
    browserAssets: options.browserAssets,
    maxBodyBytes: options.bodyLimitBytes,
    screenshotImportMaxBodyBytes: options.screenshotImportBodyLimitBytes,
    screenshotImportPreflight: createScreenshotImportPreflight(runtimeHolder, options, admissions),
    historicalImportPreflight: createHistoricalImportPreflight(runtimeHolder, options, admissions),
    simulationCompletionPreflight: createSimulationCompletionPreflight(
      runtimeHolder,
      options,
      admissions,
    ),
    trustProxy: options.trustProxy,
    activeStreamRegistry,
  });
  const globalPlayerNewsHandler = createGlobalPlayerNewsHandler(runtimeHolder, options);
  const server = createServer(async (request, response) => {
    if (await globalPlayerNewsHandler(request, response)) return;
    if (await draftToolsAdapter(request, response)) return;
    await platformNodeHandler(request, response);
  });
  return {
    server,
    abortAndDrainActiveStreams: async () => await activeStreamRegistry.abortAndDrain(),
  };
};
