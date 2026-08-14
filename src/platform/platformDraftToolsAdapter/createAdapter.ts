import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  CreatePlatformDraftToolsAdapterOptions,
  PlatformDraftToolsAdapter,
} from "./contracts.js";
import { DraftToolsUnavailableError } from "./errors.js";
import { releaseDraftToolsAppOnResponse } from "./releaseOnResponse.js";
import {
  authRequiredBody,
  draftToolsUnavailableBody,
  internalErrorBody,
  membershipRequiredBody,
  seasonRequiredBody,
  writeJson,
} from "./responses.js";
import { DraftToolsAppRegistry } from "./retainedApps/registry.js";
import { draftToolsRouteFor } from "./route.js";
import { resolveDraftToolsRuntime } from "./runtime.js";
import { delegateDraftToolsRequest } from "./serverLifecycle.js";

const handleDraftToolsRequest = async (
  options: CreatePlatformDraftToolsAdapterOptions,
  registry: DraftToolsAppRegistry,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<boolean> => {
  const route = draftToolsRouteFor(request.url);
  if (route === undefined) return false;

  try {
    const account = await options.resolveAccount(request);
    if (account === null) {
      writeJson(response, 401, authRequiredBody);
      return true;
    }
    if (account.id.trim().length === 0 || registry.isClosed()) {
      throw new Error("Draft tools adapter is unavailable.");
    }
    if (route.seasonId === null) {
      writeJson(response, 400, seasonRequiredBody);
      return true;
    }
    if (!await options.authorizeSeason(account, route.seasonId, request)) {
      writeJson(response, 403, membershipRequiredBody);
      return true;
    }

    const acquired = await registry.acquire(account.id, route.seasonId);
    const release = releaseDraftToolsAppOnResponse(registry, acquired.entry, response);
    try {
      delegateDraftToolsRequest(acquired.app, request, response, route.targetUrl);
    } catch (error) {
      release();
      throw error;
    }
  } catch (error) {
    if (response.headersSent) response.destroy();
    else if (error instanceof DraftToolsUnavailableError) {
      writeJson(response, 503, draftToolsUnavailableBody);
    } else {
      writeJson(response, 500, internalErrorBody);
    }
  }
  return true;
};

export const createPlatformDraftToolsAdapter = (
  options: CreatePlatformDraftToolsAdapterOptions,
): PlatformDraftToolsAdapter => {
  const registry = new DraftToolsAppRegistry(resolveDraftToolsRuntime(options));
  const handle = (request: IncomingMessage, response: ServerResponse): Promise<boolean> =>
    handleDraftToolsRequest(options, registry, request, response);
  return Object.assign(handle, {
    clearAccount: (accountId: string) => registry.clearAccount(accountId),
    close: () => registry.close(),
  });
};
