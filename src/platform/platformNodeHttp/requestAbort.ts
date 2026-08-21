import type { IncomingMessage, ServerResponse } from "node:http";

export interface RequestAbortLifecycle {
  readonly signal: AbortSignal;
  abort(): void;
  removeListeners(): void;
}

export const startRequestAbortLifecycle = (
  request: IncomingMessage,
  response: ServerResponse,
): RequestAbortLifecycle => {
  const controller = new AbortController();
  const abortForIncompleteRequest = (): void => controller.abort();
  const abortForClosedResponse = (): void => {
    if (!response.writableEnded) controller.abort();
  };
  request.once("aborted", abortForIncompleteRequest);
  response.once("close", abortForClosedResponse);

  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    removeListeners: () => {
      request.removeListener("aborted", abortForIncompleteRequest);
      response.removeListener("close", abortForClosedResponse);
    },
  };
};
