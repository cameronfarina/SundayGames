import { describe, expect, it } from "vitest";
import {
  buildInteractiveMockDraftState,
  resolveInteractiveMockDraftAction,
} from "../../src/modeling/interactiveMockDraft.js";
import { loadInteractiveMockDraftInputs } from "./support.js";

describe("interactive mock draft opening", () => {
  it("uses real auction nominations and pauses when Owner11 can enter the bidding", async () => {
    const inputs = await loadInteractiveMockDraftInputs();
    const state = buildInteractiveMockDraftState({
      ...inputs,
      commands: [],
      watchOwner: "Owner11",
      strategyKey: "three-rb",
      seed: "interactive-test",
    });

    expect(state.phase).toBe("human-decision");
    expect(state.nominator).toBe("Owner01");
    expect(state.nomination?.player).toBe("Jahmyr Gibbs");
    expect(state.aiSaleCommand).toMatch(/^\w+ drafted Jahmyr Gibbs for \d+$/);
    expect(state.camDecision?.recommendedBid).toBe(state.auction?.nextCamBid);
    expect(state.auction?.feed.map(event => event.text))
      .toContain("Owner01 nominated Jahmyr Gibbs for $70");
    expect(state.aiBids[0]).toMatchObject({
      player: "Jahmyr Gibbs",
      owner: expect.not.stringMatching(/^Owner11$/),
    });
    expect(state.topTargets[0]).toMatchObject({
      name: "Jahmyr Gibbs",
      position: "RB",
    });
  });

  it("keeps AI sale previews open until the advance action logs the sale", async () => {
    const inputs = await loadInteractiveMockDraftInputs();
    const state = buildInteractiveMockDraftState({
      ...inputs,
      commands: ["Owner11 drafted Jahmyr Gibbs for 80"],
      watchOwner: "Owner11",
      strategyKey: "three-rb",
      seed: "y",
    });

    expect(state.phase).toBe("ai-sale");
    expect(state.auction?.status).toBe("ai-sale");
    expect(state.auction?.resolution?.command).toBe(state.aiSaleCommand);
    expect(state.auction?.feed.map(event => event.type)).toEqual([
      "nomination",
      "bid",
      "bid",
      "bid",
      "bid",
    ]);
    const resolved = resolveInteractiveMockDraftAction(state, "advance");
    expect(resolved.command).toBe(state.aiSaleCommand);
  });
});
