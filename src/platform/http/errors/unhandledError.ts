import type { PlatformHttpErrorBody, PlatformHttpResponse } from "../contracts.js";
import { knownError } from "../responses.js";

/**
 * The last resort. Grep production logs for "unhandled_platform_error" to find
 * the stack behind any 500 the browser reports as "Something went wrong".
 */
export const unhandledErrorResponse = (
  error: unknown,
): PlatformHttpResponse<PlatformHttpErrorBody> => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    event: "unhandled_platform_error",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }));
  return knownError(500, "internal_error", "Something went wrong.");
};
