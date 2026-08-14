import type { PlatformHttpErrorBody, PlatformHttpResponse } from "../platformHttp.js";

export class InvalidJsonBodyError extends Error {}
export class RequestBodyTooLargeError extends Error {}

export const invalidJsonResponse: PlatformHttpResponse<PlatformHttpErrorBody> = {
  status: 400,
  body: { error: { code: "invalid_json", message: "Request body must be valid JSON." } },
};

export const requestBodyTooLargeResponse: PlatformHttpResponse<PlatformHttpErrorBody> = {
  status: 413,
  body: {
    error: {
      code: "request_body_too_large",
      message: "Request body exceeds the configured size limit.",
    },
  },
};

export const unsupportedMediaTypeResponse: PlatformHttpResponse<PlatformHttpErrorBody> = {
  status: 415,
  body: {
    error: { code: "unsupported_media_type", message: "Request body must use application/json." },
  },
};

export const screenshotImportPreflightUnavailableResponse:
PlatformHttpResponse<PlatformHttpErrorBody> = {
  status: 503,
  body: {
    error: {
      code: "screenshot_import_unavailable",
      message: "Screenshot import is not configured for this deployment.",
    },
  },
};

export const internalErrorResponse: PlatformHttpResponse<PlatformHttpErrorBody> = {
  status: 500,
  body: { error: { code: "internal_error", message: "Something went wrong." } },
};
