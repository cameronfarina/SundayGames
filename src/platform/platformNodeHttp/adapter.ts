import type { IncomingMessage, ServerResponse } from "node:http";
import type { PlatformHttpHandler } from "../platformHttp.js";
import { assertPlatformJsonMediaType } from "../platformJsonMediaType.js";
import { admitPlatformRequest } from "./admission.js";
import { prepareBrowserAssets } from "./browserAssets.js";
import { handleBrowserRequest } from "./browserRequest.js";
import {
  defaultPlatformJsonBodyLimitBytes,
  defaultPlatformScreenshotImportBodyLimitBytes,
} from "./constants.js";
import type { PlatformNodeHttpAdapterOptions } from "./contracts.js";
import { writeAdapterErrorResponse } from "./errorResponse.js";
import { platformRequestFor } from "./requestFactory.js";
import { bodyLimitForRequest } from "./requestKinds.js";
import { startRequestAbortLifecycle } from "./requestAbort.js";
import { ensurePlatformRequestId } from "./requestId.js";
import { setTransportSecurityHeader } from "./securityHeaders.js";
import { writePlatformResponse } from "./writePlatformResponse.js";

export const createPlatformNodeHttpAdapter = (
  handle: PlatformHttpHandler,
  options: PlatformNodeHttpAdapterOptions = {},
): ((request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
  const appHtml = options.appHtml;
  const browserAssets = prepareBrowserAssets(options.browserAssets);
  const maxBodyBytes = options.maxBodyBytes ?? defaultPlatformJsonBodyLimitBytes;
  const screenshotImportMaxBodyBytes = options.screenshotImportMaxBodyBytes
    ?? defaultPlatformScreenshotImportBodyLimitBytes;
  const screenshotImportPreflight = options.screenshotImportPreflight;
  const historicalImportPreflight = options.historicalImportPreflight;
  const trustProxy = options.trustProxy ?? false;

  return async (request, response) => {
    ensurePlatformRequestId(request, response);
    setTransportSecurityHeader(request, response, trustProxy);

    try {
      if (handleBrowserRequest(request, response, appHtml, browserAssets)) return;
      assertPlatformJsonMediaType(request.method, request.headers);

      const admission = await admitPlatformRequest(
        request,
        response,
        screenshotImportPreflight,
        historicalImportPreflight,
        trustProxy,
      );
      if (admission.handled) return;

      const abortLifecycle = startRequestAbortLifecycle(request, response);
      try {
        const bodyLimit = bodyLimitForRequest(
          request,
          maxBodyBytes,
          screenshotImportMaxBodyBytes,
        );
        const platformRequest = await platformRequestFor(
          request,
          bodyLimit,
          trustProxy,
          abortLifecycle.signal,
        );
        const platformResponse = await handle(platformRequest);
        if (!response.destroyed) await writePlatformResponse(request, response, platformResponse);
      } finally {
        admission.permit?.release();
        abortLifecycle.removeListeners();
      }
    } catch (error) {
      await writeAdapterErrorResponse(request, response, error);
    }
  };
};
