import type { PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { headerValue } from "../../request/values.js";

const acceptsLegacySimulationStream = (request: ParsedPlatformHttpRequest): boolean =>
  headerValue(request.headers, "accept")
    ?.split(",")
    .some(value => value.trim().toLowerCase().startsWith("text/event-stream")) === true;

export const legacySimulationClientResponse = (
  request: ParsedPlatformHttpRequest,
): PlatformHttpResponse<string> | null => {
  if (!acceptsLegacySimulationStream(request)) return null;
  const payload = JSON.stringify({
    error: {
      code: "simulation_client_upgrade_required",
      message: "Refresh Sunday Games, then retry this simulation.",
    },
  });
  return {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
    body: `event: error\ndata: ${payload}\n\n`,
  };
};
