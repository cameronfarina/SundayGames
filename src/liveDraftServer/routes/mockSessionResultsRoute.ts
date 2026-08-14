import type { MockBatch } from "../../modeling/mockBatch.js";
import type { MockBatchJob } from "../contracts.js";
import { parseJsonBody, sendJson } from "../http.js";
import { seedFromValue } from "../mockInput.js";
import { mockDraftRequestFor } from "../mockState.js";
import { strategyKeyFromBody } from "../routeHelpers.js";
import type { RouteHandler } from "../runtimeContracts.js";
import { draftNightLockFor, watchOwnerFromBody } from "../sessionInput.js";

export const handleMockSessionResultsRoute: RouteHandler = async ({
  request,
  response,
  url,
  context,
}) => {
  if (request.method !== "POST" || url.pathname !== "/api/mock/session-results") return false;
  const body = await parseJsonBody(request, context.bodyLimitForPath(url.pathname));
  const strategyKey = strategyKeyFromBody(body);
  const draftSessionKey = context.enabledDraftSessionKeyFromBody(body);
  const watchOwner = watchOwnerFromBody(body);
  const seed = seedFromValue(body.seed ?? body.seedPrefix);
  const lock = draftNightLockFor(draftSessionKey);
  if (lock.locked) {
    sendJson(response, 423, {
      ...await context.state.stateFor({ draftSessionKey, mode: "interactive-mock", strategyKey, watchOwner }),
      errors: [{ input: "", message: lock.reason ?? "Live session is locked for mock draft results." }],
    });
    return true;
  }

  let publishedJob: MockBatchJob | undefined;
  const result = await context.stores.runQueuedMutation(
    draftSessionKey,
    "interactive-mock",
    async () => {
      const store = await context.stores.storeFor(draftSessionKey, "interactive-mock");
      const commands = store.currentCommands();
      const expected = body.expectedCommandCount;
      if (typeof expected === "number" && Number.isInteger(expected) && expected !== commands.length) {
        return {
          status: 409,
          body: {
            ...await context.interactive.stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed),
              draftSessionKey,
              watchOwner,
            }),
            errors: [{
              input: "",
              message: `Mock results expected ${expected} command(s), but the room currently has ${commands.length}. Refresh before viewing results.`,
            }],
          },
        };
      }

      let batch: MockBatch;
      try {
        batch = await context.interactive.interactiveBatchForCommands({
          draftSessionKey,
          watchOwner,
          strategyKey,
          commands,
          ...(seed === undefined ? {} : { seed }),
        });
      } catch (error) {
        return {
          status: 422,
          body: {
            ...await context.interactive.stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed),
              draftSessionKey,
              watchOwner,
            }),
            errors: [{
              input: "",
              message: error instanceof Error
                ? error.message
                : "Could not build results from the current mock draft.",
            }],
          },
        };
      }

      try {
        const job = context.batches.publishInteractiveResults({
          draftSessionKey,
          watchOwner,
          strategyKey,
          commandCount: commands.length,
          batch,
        });
        publishedJob = job;
        return {
          status: 200,
          body: {
            ...await context.interactive.stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed),
              draftSessionKey,
              watchOwner,
            }),
            mockBatchJob: job,
          },
        };
      } catch (error) {
        return {
          status: 422,
          body: {
            ...await context.interactive.stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed),
              draftSessionKey,
              watchOwner,
            }),
            errors: [{
              input: "",
              message: error instanceof Error
                ? error.message
                : "Could not publish mock draft results.",
            }],
          },
        };
      }
    },
  );
  sendJson(response, result.status, {
    ...result.body,
    ...(publishedJob === undefined
      ? {}
      : { mockBatchJob: context.batches.responseFor(publishedJob) }),
  });
  return true;
};
