import {
  responseContractFor,
  type AuthenticatedLoadRequest,
  type AuthenticatedLoadResult,
} from "./httpResponseContracts.js";

export type {
  AuthenticatedLoadRequest,
  AuthenticatedLoadResult,
  QueuedLoadJob,
} from "./httpResponseContracts.js";

export const runAuthenticatedHttpBurst = async (
  baseUrl: URL,
  requests: readonly AuthenticatedLoadRequest[],
): Promise<readonly AuthenticatedLoadResult[]> => {
  return await Promise.all(requests.map(async request => {
    const startedAt = performance.now();
    try {
      const response = await fetch(new URL(request.path, baseUrl), {
        method: request.method,
        redirect: "error",
        headers: {
          "x-session-token": request.sessionToken,
          ...(request.body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        signal: AbortSignal.timeout(30_000),
      });
      const contract = await responseContractFor(response, request);
      return {
        ...contract,
        durationMs: performance.now() - startedAt,
        ok: contract.diagnostic.startsWith("ok"),
        status: response.status,
      };
    } catch {
      return {
        diagnostic: "request_error",
        durationMs: performance.now() - startedAt,
        ok: false,
      };
    }
  }));
};
