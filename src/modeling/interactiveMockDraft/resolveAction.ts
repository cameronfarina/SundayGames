import { nextAiBidAfterCam, stateAfterAiRaise } from "./aiRaise.js";
import type {
  InteractiveMockDraftAction,
  InteractiveMockDraftActionResult,
  InteractiveMockDraftState,
} from "./contracts.js";
import { resolvedAuctionFor } from "./resolvedAuction.js";

const resolveHumanBid = (
  state: InteractiveMockDraftState,
): InteractiveMockDraftActionResult => {
  if (!state.nomination || !state.camDecision) {
    throw new Error(`${state.watchOwner} does not have a live decision to win.`);
  }
  const camBid = state.auction?.nextCamBid ?? state.camDecision.recommendedBid;
  if (camBid > state.camDecision.maxBid) {
    throw new Error(
      `${state.watchOwner} cannot bid ${camBid}; max bid is ${state.camDecision.maxBid}.`,
    );
  }

  const aiRaise = nextAiBidAfterCam(state, camBid);
  if (!aiRaise) {
    const resolved = resolvedAuctionFor(state, state.watchOwner, camBid);
    return {
      command: resolved.command,
      ...(resolved.auction === undefined ? {} : {
        mockDraft: {
          ...state,
          phase: "ai-sale",
          auction: resolved.auction,
        },
      }),
    };
  }

  const nextState = stateAfterAiRaise(state, camBid, aiRaise);
  if ((nextState.auction?.nextCamBid ?? 0) <= state.camDecision.maxBid) {
    return { mockDraft: nextState };
  }

  const price = nextState.auction?.currentBid ?? camBid + 1;
  const resolved = resolvedAuctionFor(nextState, aiRaise.owner, price);
  return {
    command: resolved.command,
    ...(resolved.auction === undefined ? {} : {
      mockDraft: {
        ...nextState,
        phase: "ai-sale",
        auction: resolved.auction,
      },
    }),
  };
};

const resolveAiSale = (
  state: InteractiveMockDraftState,
  action: InteractiveMockDraftAction,
): InteractiveMockDraftActionResult => {
  const owner = state.auction?.currentBidOwner;
  const price = state.auction?.currentBid;
  if (action === "pass" && state.nomination && owner && price) {
    const resolved = resolvedAuctionFor(state, owner, price);
    return { command: resolved.command };
  }
  if (!state.aiSaleCommand) {
    throw new Error("No AI sale is ready to advance.");
  }
  return { command: state.aiSaleCommand };
};

export const resolveInteractiveMockDraftAction = (
  state: InteractiveMockDraftState,
  action: InteractiveMockDraftAction,
): InteractiveMockDraftActionResult => {
  if (action === "cam-bid" || action === "cam-win") {
    return resolveHumanBid(state);
  }
  if (action === "advance" || action === "pass") {
    return resolveAiSale(state, action);
  }
  throw new Error(`Unknown mock draft action "${action}".`);
};
