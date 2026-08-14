import { parseLiveDraftCommandImport } from "../../liveDraftSessionStore.js";
import { importConflictReviewFor } from "../importConflicts.js";
import { importFormatFor, parseJsonBody, sendJson } from "../http.js";
import { strategyKeyFromBody, unsafeLiveMutationMessage } from "../routeHelpers.js";
import type { RouteHandler, RouteRequest } from "../runtimeContracts.js";
import { sessionModeFromBodyForSession, watchOwnerFromBody } from "../sessionInput.js";

const handleImport = async ({ request, response, url, context }: RouteRequest): Promise<void> => {
  const body = await parseJsonBody(request, context.bodyLimitForPath(url.pathname));
  const strategyKey = strategyKeyFromBody(body);
  const draftSessionKey = context.enabledDraftSessionKeyFromBody(body);
  const mode = sessionModeFromBodyForSession(body, draftSessionKey);
  const watchOwner = watchOwnerFromBody(body);
  const store = await context.stores.storeFor(draftSessionKey, mode);
  let importedCommands: string[];
  try {
    importedCommands = Array.isArray(body.commands)
      ? parseLiveDraftCommandImport(JSON.stringify({ commands: body.commands }), "json")
      : parseLiveDraftCommandImport(
        typeof body.content === "string" ? body.content : "",
        importFormatFor(body.format),
      );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft log import could not be read.";
    const parseError = { input: "", message };
    sendJson(response, 422, {
      ...await context.state.stateFor({ draftSessionKey, mode, strategyKey, watchOwner }),
      errors: [parseError],
      conflictReview: importConflictReviewFor([], [parseError], "Import could not be read"),
    });
    return;
  }
  const result = await context.stores.runQueuedMutation(draftSessionKey, mode, async () => {
    const unsafeMessage = unsafeLiveMutationMessage({
      draftSessionKey,
      mode,
      body,
      confirmField: "confirmImport",
      actionLabel: "import",
      commandCount: store.currentCommands().length,
    });
    if (unsafeMessage) {
      return {
        status: 409,
        body: {
          ...await context.state.stateFor({ draftSessionKey, mode, strategyKey, watchOwner }),
          errors: [{ input: "", message: unsafeMessage }],
        },
      };
    }
    const trialState = await context.state.stateFor({
      draftSessionKey,
      mode,
      commands: importedCommands,
      strategyKey,
      watchOwner,
    });
    if (trialState.errors.length) {
      return {
        status: 422,
        body: {
          ...await context.state.stateFor({ draftSessionKey, mode, strategyKey, watchOwner }),
          errors: trialState.errors,
          conflictReview: importConflictReviewFor(importedCommands, trialState.errors),
        },
      };
    }
    await store.importCommands(importedCommands);
    return {
      status: 200,
      body: await context.state.stateFor({ draftSessionKey, mode, strategyKey, watchOwner }),
    };
  });
  sendJson(response, result.status, result.body);
};

const handleSingleMutation = async (
  route: RouteRequest,
  action: "undo" | "reset",
): Promise<void> => {
  const { request, response, url, context } = route;
  const body = await parseJsonBody(request, context.bodyLimitForPath(url.pathname));
  const strategyKey = strategyKeyFromBody(body);
  const draftSessionKey = context.enabledDraftSessionKeyFromBody(body);
  const mode = sessionModeFromBodyForSession(body, draftSessionKey);
  const watchOwner = watchOwnerFromBody(body);
  const store = await context.stores.storeFor(draftSessionKey, mode);
  const result = await context.stores.runQueuedMutation(draftSessionKey, mode, async () => {
    const unsafeMessage = unsafeLiveMutationMessage({
      draftSessionKey,
      mode,
      body,
      confirmField: action === "undo" ? "confirmUndo" : "confirmReset",
      actionLabel: action,
      commandCount: store.currentCommands().length,
    });
    if (unsafeMessage) {
      return {
        status: 409,
        body: {
          ...await context.state.stateFor({ draftSessionKey, mode, strategyKey, watchOwner }),
          errors: [{ input: "", message: unsafeMessage }],
        },
      };
    }
    if (action === "undo") await store.undo();
    else await store.reset();
    return {
      status: 200,
      body: await context.state.stateFor({ draftSessionKey, mode, strategyKey, watchOwner }),
    };
  });
  sendJson(response, result.status, result.body);
};

export const handleSessionMutationRoutes: RouteHandler = async route => {
  if (route.request.method !== "POST") return false;
  if (route.url.pathname === "/api/import") {
    await handleImport(route);
    return true;
  }
  if (route.url.pathname === "/api/undo" || route.url.pathname === "/api/reset") {
    await handleSingleMutation(route, route.url.pathname === "/api/undo" ? "undo" : "reset");
    return true;
  }
  return false;
};
