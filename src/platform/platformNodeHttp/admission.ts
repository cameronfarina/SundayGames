import type { IncomingMessage, ServerResponse } from "node:http";
import type { PlatformHttpResponse } from "../platformHttp.js";
import type {
  PlatformNodeHttpAdmission,
  PlatformNodeHttpAdmissionPermit,
  PlatformNodeHttpPreflight,
} from "./contracts.js";
import { screenshotImportPreflightUnavailableResponse } from "./errors.js";
import { platformRequestMetadataFor } from "./requestFactory.js";
import {
  isHistoricalImportPreviewRequest,
  isScreenshotImportAnalysisRequest,
} from "./requestKinds.js";
import { writePlatformResponse } from "./writePlatformResponse.js";

const isPlatformHttpResponse = (
  result: PlatformHttpResponse | PlatformNodeHttpAdmissionPermit,
): result is PlatformHttpResponse => "status" in result;

const rejectRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  platformResponse: PlatformHttpResponse,
): Promise<void> => {
  response.shouldKeepAlive = false;
  response.setHeader("Connection", "close");
  await writePlatformResponse(request, response, platformResponse);
};

export interface PlatformNodeHttpAdmissionResult {
  readonly handled: boolean;
  readonly permit?: PlatformNodeHttpAdmissionPermit | undefined;
}

export const admitPlatformRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  screenshotImportPreflight: PlatformNodeHttpPreflight | undefined,
  historicalImportPreflight: PlatformNodeHttpAdmission | undefined,
  trustProxy: boolean,
): Promise<PlatformNodeHttpAdmissionResult> => {
  if (isScreenshotImportAnalysisRequest(request)) {
    const preflightResponse = screenshotImportPreflight === undefined
      ? screenshotImportPreflightUnavailableResponse
      : await screenshotImportPreflight(platformRequestMetadataFor(request, trustProxy));
    if (preflightResponse !== null) {
      await rejectRequest(request, response, preflightResponse);
      return { handled: true };
    }
  }

  if (isHistoricalImportPreviewRequest(request) && historicalImportPreflight !== undefined) {
    const admission = await historicalImportPreflight(
      platformRequestMetadataFor(request, trustProxy),
    );
    if (isPlatformHttpResponse(admission)) {
      await rejectRequest(request, response, admission);
      return { handled: true };
    }
    return { handled: false, permit: admission };
  }
  return { handled: false };
};
