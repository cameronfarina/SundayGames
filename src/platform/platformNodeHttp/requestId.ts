import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const requestIds = new WeakMap<IncomingMessage, string>();

export const ensurePlatformRequestId = (
  request: IncomingMessage,
  response: ServerResponse,
): string => {
  const existingRequestId = requestIds.get(request);
  if (existingRequestId !== undefined) {
    if (!response.headersSent && !response.hasHeader("X-Request-ID")) {
      response.setHeader("X-Request-ID", existingRequestId);
    }
    return existingRequestId;
  }
  const requestId = randomUUID();
  requestIds.set(request, requestId);
  response.setHeader("X-Request-ID", requestId);
  return requestId;
};
