import { describe, expect, it } from "vitest";
import {
  buildInteractiveMockDraftState,
  resolveInteractiveMockDraftAction,
  type InteractiveMockDraftState,
} from "../../src/modeling/interactiveMockDraft.js";
import {
  commandsBeforeAffordableRb3Decision,
  loadInteractiveMockDraftInputs,
} from "./support.js";

describe("interactive mock draft bidding", () => {
  it("stops for Owner11 when his strategy max beats the AI price", async () => {
    const inputs = await loadInteractiveMockDraftInputs();
    const commands = commandsBeforeAffordableRb3Decision.slice(0, 10);
    const state = buildInteractiveMockDraftState({
      ...inputs,
      commands,
      watchOwner: "Owner11",
      strategyKey: "three-rb",
      seed: "interactive-test",
      nominatedPlayer: "Breece Hall",
    });

    expect(state.phase).toBe("human-decision");
    expect(state.nomination?.player).toBe("Breece Hall");
    expect(state.camDecision).toMatchObject({ maxBid: 44, recommendedBid: 40 });
    expect(state.camDecision?.topAiBid).toBeGreaterThanOrEqual(state.auction?.currentBid ?? 0);
    expect(state.camDecision?.topAiBidOwner).toEqual(expect.any(String));
    expect(state.auction).toMatchObject({ currentBid: 39, nextCamBid: 40 });
    expect(state.auction?.currentBidOwner).toEqual(expect.any(String));
    expect(state.camDecision?.maxBid).toBeGreaterThanOrEqual(state.auction?.nextCamBid ?? 0);

    const camBid = resolveInteractiveMockDraftAction(state, "cam-bid");
    const pass = resolveInteractiveMockDraftAction(state, "pass");
    expect(camBid.command).toBeUndefined();
    expect(camBid.mockDraft?.auction?.currentBid).toBe(41);
    expect(camBid.mockDraft?.auction?.nextCamBid).toBe(42);
    expect(pass.command).toBe(state.aiSaleCommand);
  });

  it("exposes the current auction bid and lets AI continue after Owner11 raises", async () => {
    const inputs = await loadInteractiveMockDraftInputs();
    const commands = commandsBeforeAffordableRb3Decision.slice(0, 10);
    const state = buildInteractiveMockDraftState({
      ...inputs,
      commands,
      watchOwner: "Owner11",
      strategyKey: "three-rb",
      seed: "interactive-auction-test",
      nominatedPlayer: "Breece Hall",
    });

    expect(state.phase).toBe("human-decision");
    expect(state.auction).toMatchObject({
      status: "cam-decision",
      player: "Breece Hall",
      currentBid: state.camDecision?.aiSalePrice,
      nextCamBid: (state.camDecision?.aiSalePrice ?? 0) + 1,
    });
    expect(state.camDecision?.recommendedBid).toBe(state.auction?.nextCamBid);
    expect(state.auction?.feed[0]?.text).toBe(
      `${state.nominator} nominated Breece Hall for $${state.auction?.openingBid}`,
    );
    if (state.auction === undefined) throw new Error("Expected an active auction.");

    const contestedState: InteractiveMockDraftState = {
      ...state,
      aiBids: [
        { owner: "Owner10", player: "Breece Hall", amount: 45, maxBid: 45, marketPrice: 37 },
        { owner: "Owner07", player: "Breece Hall", amount: 43, maxBid: 43, marketPrice: 37 },
      ],
      camDecision: {
        maxBid: 46,
        recommendedBid: 42,
        topAiBid: 45,
        topAiBidOwner: "Owner10",
        aiSalePrice: 41,
        valueGap: 8,
      },
      auction: {
        ...state.auction,
        status: "cam-decision",
        currentBid: 41,
        currentBidOwner: "Owner10",
        nextCamBid: 42,
        feed: [
          { type: "nomination", text: "Owner11 nominated Breece Hall for $37" },
          { type: "bid", owner: "Owner10", amount: 41, text: "Owner10 bid $41" },
        ],
      },
    };

    const aiRaise = resolveInteractiveMockDraftAction(contestedState, "cam-bid");
    expect(aiRaise.command).toBeUndefined();
    expect(aiRaise.mockDraft?.phase).toBe("human-decision");
    expect(aiRaise.mockDraft?.auction?.currentBid).toBe(43);
    expect(aiRaise.mockDraft?.auction?.currentBidOwner).toBe("Owner10");
    expect(aiRaise.mockDraft?.auction?.nextCamBid).toBe(44);
    expect(aiRaise.mockDraft?.auction?.feed.map(event => event.text)).toEqual([
      "Owner11 nominated Breece Hall for $37",
      "Owner10 bid $41",
      "Owner11 bid $42",
      "Owner10 bid $43",
    ]);
  });
});
