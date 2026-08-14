import { createServer, type Server } from "node:http";
import type { PlatformDraftToolsAdapter } from "../platformDraftToolsAdapter.js";
import type { PlatformHttpHandler } from "../platformHttp.js";
import { createPlatformNodeHttpAdapter } from "../platformNodeHttp.js";
import { platformFallbackHtml } from "../platformFallbackHtml.js";
import type { PlatformAdmissions } from "./admissions.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import { createHistoricalImportPreflight } from "./historicalImportPreflight.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";
import { createScreenshotImportPreflight } from "./screenshotPreflight.js";

export const createNodeServer = (
  handler: PlatformHttpHandler,
  draftToolsAdapter: PlatformDraftToolsAdapter,
  runtimeHolder: PlatformRuntimeHolder,
  options: CreatePlatformServerOptions,
  admissions: PlatformAdmissions,
): Server => {
  const platformNodeHandler = createPlatformNodeHttpAdapter(handler, {
    appHtml: options.appHtml ?? platformFallbackHtml,
    browserAssets: options.browserAssets,
    maxBodyBytes: options.bodyLimitBytes,
    screenshotImportMaxBodyBytes: options.screenshotImportBodyLimitBytes,
    screenshotImportPreflight: createScreenshotImportPreflight(runtimeHolder, options, admissions),
    historicalImportPreflight: createHistoricalImportPreflight(runtimeHolder, options, admissions),
    trustProxy: options.trustProxy,
  });
  return createServer(async (request, response) => {
    if (await draftToolsAdapter(request, response)) return;
    await platformNodeHandler(request, response);
  });
};
