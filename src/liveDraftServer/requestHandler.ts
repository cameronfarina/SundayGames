import type { IncomingMessage, ServerResponse } from "node:http";
import { RequestBodyTooLargeError, ScratchSessionsDisabledError, scratchSessionsDisabledBody, sendJson } from "./http.js";
import type { RouteContext, RouteHandler } from "./runtimeContracts.js";
import { handleEventRoute } from "./routes/eventRoute.js";
import { handleMockAdvanceRoute } from "./routes/mockAdvanceRoute.js";
import { handleMockBatchRoutes } from "./routes/mockBatchRoutes.js";
import { handleMockSessionResultsRoute } from "./routes/mockSessionResultsRoute.js";
import { handleReadRoutes } from "./routes/readRoutes.js";
import { handleSessionMutationRoutes } from "./routes/sessionMutationRoutes.js";

const handlers: readonly RouteHandler[] = [
  handleReadRoutes,
  handleEventRoute,
  handleMockAdvanceRoute,
  handleMockSessionResultsRoute,
  handleMockBatchRoutes,
  handleSessionMutationRoutes,
];

export const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
): Promise<void> => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    for (const handler of handlers) {
      if (await handler({ request, response, url, context })) return;
    }
    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    if (error instanceof ScratchSessionsDisabledError) {
      sendJson(response, 404, scratchSessionsDisabledBody);
      return;
    }
    if (error instanceof RequestBodyTooLargeError) {
      request.pause();
      response.shouldKeepAlive = false;
      response.setHeader("connection", "close");
      response.once("finish", () => request.destroy());
      sendJson(response, 413, {
        error: {
          code: "request_body_too_large",
          message: "Request body exceeds the configured size limit.",
        },
      });
      return;
    }
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unknown live draft server error.",
    });
  }
};
