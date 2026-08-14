import type { IncomingMessage, ServerResponse } from "node:http";
import { UnsupportedMediaTypeError } from "../platformJsonMediaType.js";
import {
  internalErrorResponse,
  InvalidJsonBodyError,
  invalidJsonResponse,
  RequestBodyTooLargeError,
  requestBodyTooLargeResponse,
  unsupportedMediaTypeResponse,
} from "./errors.js";
import { writePlatformResponse } from "./writePlatformResponse.js";

export const writeAdapterErrorResponse = async (
  request: IncomingMessage,
  response: ServerResponse,
  error: unknown,
): Promise<void> => {
  if (response.headersSent) {
    if (!response.destroyed && !response.writableEnded) response.end();
    return;
  }
  if (error instanceof RequestBodyTooLargeError) {
    await writePlatformResponse(request, response, requestBodyTooLargeResponse);
    return;
  }
  if (error instanceof InvalidJsonBodyError) {
    await writePlatformResponse(request, response, invalidJsonResponse);
    return;
  }
  if (error instanceof UnsupportedMediaTypeError) {
    request.resume();
    await writePlatformResponse(request, response, unsupportedMediaTypeResponse);
    return;
  }
  await writePlatformResponse(request, response, internalErrorResponse);
};
