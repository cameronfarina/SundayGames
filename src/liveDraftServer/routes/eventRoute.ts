import { parseJsonBody, sendJson } from "../http.js";
import type { RouteHandler } from "../runtimeContracts.js";
import { strategyKeyFromBody } from "../routeHelpers.js";
import { sessionModeFromBodyForSession, watchOwnerFromBody } from "../sessionInput.js";

export const handleEventRoute: RouteHandler = async ({ request, response, url, context }) => {
  if (request.method !== "POST" || url.pathname !== "/api/events") return false;
  const body = await parseJsonBody(request, context.bodyLimitForPath(url.pathname));
  const strategyKey = strategyKeyFromBody(body);
  const draftSessionKey = context.enabledDraftSessionKeyFromBody(body);
  const watchOwner = watchOwnerFromBody(body);
  const mode = sessionModeFromBodyForSession(body, draftSessionKey);
  const store = await context.stores.storeFor(draftSessionKey, mode);
  const command = typeof body.command === "string" ? body.command.trim() : "";
  if (!command) {
    sendJson(response, 422, {
      ...await context.state.stateFor({ draftSessionKey, mode, strategyKey, watchOwner }),
      errors: [{ input: "", message: "Command is required." }],
    });
    return true;
  }
  const result = await context.stores.runQueuedMutation(draftSessionKey, mode, async () => {
    const trialCommands = [...store.currentCommands(), command];
    const trialState = await context.state.stateFor({
      draftSessionKey,
      mode,
      commands: trialCommands,
      strategyKey,
      watchOwner,
    });
    const commandError = trialState.errors.find(error => error.input === command);
    if (commandError) {
      return {
        status: 422,
        body: {
          ...await context.state.stateFor({ draftSessionKey, mode, strategyKey, watchOwner }),
          errors: [commandError],
        },
      };
    }
    await store.appendCommand(command);
    return {
      status: 200,
      body: await context.state.stateFor({ draftSessionKey, mode, strategyKey, watchOwner }),
    };
  });
  sendJson(response, result.status, result.body);
  return true;
};
