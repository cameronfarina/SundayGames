import type { ServerResponse } from "node:http";

export const applyPlatformResponseHeaders = (
  response: ServerResponse,
  headers: Record<string, string | readonly string[] | undefined> | undefined,
): void => {
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (name.toLowerCase() !== "x-request-id" && value !== undefined) {
      response.setHeader(name, value);
    }
  }
};
