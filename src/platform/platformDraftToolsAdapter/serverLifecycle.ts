import type { IncomingMessage, ServerResponse } from "node:http";
import type { LiveDraftServerApp } from "../../liveDraftServer.js";
import { securityHeaders } from "./responses.js";

export const disposeDraftToolsApp = async (app: LiveDraftServerApp): Promise<void> => {
  app.server.removeAllListeners("request");
  app.server.closeAllConnections();
  app.server.closeIdleConnections();
  if (!app.server.listening) return;

  await new Promise<void>((resolveClose, rejectClose) => {
    app.server.close(error => {
      if (error === undefined) resolveClose();
      else rejectClose(error);
    });
  });
};

export const delegateDraftToolsRequest = (
  app: LiveDraftServerApp,
  request: IncomingMessage,
  response: ServerResponse,
  targetUrl: string,
): void => {
  const originalUrl = request.url;
  let restored = false;
  const restoreRequestUrl = (): void => {
    if (restored) return;
    restored = true;
    request.url = originalUrl;
    response.off("finish", restoreRequestUrl);
    response.off("close", restoreRequestUrl);
  };

  request.url = targetUrl;
  for (const [name, value] of Object.entries(securityHeaders)) {
    if (!response.hasHeader(name)) response.setHeader(name, value);
  }
  response.once("finish", restoreRequestUrl);
  response.once("close", restoreRequestUrl);

  try {
    if (!app.server.emit("request", request, response)) {
      throw new Error("Classic draft server has no request handler.");
    }
  } catch (error) {
    restoreRequestUrl();
    throw error;
  }
};
