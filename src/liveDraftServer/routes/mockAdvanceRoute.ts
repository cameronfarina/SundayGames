import { parseJsonBody, sendJson } from "../http.js";
import {
  nominatedPlayerFromValue,
  nominatedPriceFromValue,
  seedFromValue,
} from "../mockInput.js";
import {
  mockAuctionFromValue,
  mockDraftRequestFor,
  mockSpeedActions,
} from "../mockState.js";
import { strategyKeyFromBody } from "../routeHelpers.js";
import type { RouteHandler } from "../runtimeContracts.js";
import { draftNightLockFor, watchOwnerFromBody } from "../sessionInput.js";
import { advanceMockDraft } from "./mockAdvanceMutation.js";

export const handleMockAdvanceRoute: RouteHandler = async ({ request, response, url, context }) => {
  if (request.method !== "POST" || url.pathname !== "/api/mock/advance") return false;
  const body = await parseJsonBody(request, context.bodyLimitForPath(url.pathname));
  const strategyKey = strategyKeyFromBody(body);
  const draftSessionKey = context.enabledDraftSessionKeyFromBody(body);
  const watchOwner = watchOwnerFromBody(body);
  const seed = seedFromValue(body.seed);
  const nominatedPlayer = nominatedPlayerFromValue(body.nominatedPlayer);
  const nominatedPrice = nominatedPriceFromValue(body.nominatedPrice);
  const mockAuction = mockAuctionFromValue(body.mockAuction);
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const lock = draftNightLockFor(draftSessionKey);
  if (lock.locked) {
    sendJson(response, 423, {
      ...await context.state.stateFor({ draftSessionKey, mode: "interactive-mock", strategyKey, watchOwner }),
      errors: [{ input: "", message: lock.reason ?? "Live session is locked for mock draft advances." }],
    });
    return true;
  }
  if (!action) {
    sendJson(response, 422, {
      ...await context.interactive.stateWithMockDraft({
        ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
        draftSessionKey,
        watchOwner,
      }),
      errors: [{ input: "", message: "Mock draft action is required." }],
    });
    return true;
  }
  if (mockSpeedActions.has(action)) {
    const result = await context.stores.runQueuedMutation(
      draftSessionKey,
      "interactive-mock",
      () => context.interactive.runSpeedAction({
        draftSessionKey,
        watchOwner,
        strategyKey,
        action,
        ...(seed === undefined ? {} : { seed }),
        ...(nominatedPlayer === undefined ? {} : { nominatedPlayer }),
        ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
      }),
    );
    sendJson(response, result.status, result.body);
    return true;
  }
  if (action === "cam-nominate") {
    if (!nominatedPlayer) {
      sendJson(response, 422, {
        ...await context.interactive.stateWithMockDraft({
          ...mockDraftRequestFor(strategyKey, seed),
          draftSessionKey,
          watchOwner,
        }),
        errors: [{ input: "", message: `Select a player for ${watchOwner} to nominate.` }],
      });
      return true;
    }
    sendJson(response, 200, await context.interactive.stateWithMockDraft({
      ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
      draftSessionKey,
      watchOwner,
    }));
    return true;
  }

  const result = await advanceMockDraft({
    action,
    context,
    draftSessionKey,
    mockAuction,
    nominatedPlayer,
    nominatedPrice,
    seed,
    strategyKey,
    watchOwner,
  });
  sendJson(response, result.status, result.body);
  return true;
};
