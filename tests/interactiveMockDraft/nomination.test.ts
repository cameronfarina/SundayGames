import { describe, expect, it } from "vitest";
import {
  buildInteractiveMockDraftState,
  resolveInteractiveMockDraftAction,
} from "../../src/modeling/interactiveMockDraft.js";
import {
  commandsBeforeAffordableRb3Decision,
  loadInteractiveMockDraftInputs,
} from "./support.js";

describe("interactive mock draft nominations", () => {
  it("lets Owner11 explicitly nominate a selected player on his snake turn", async () => {
    const inputs = await loadInteractiveMockDraftInputs();
    const commands = commandsBeforeAffordableRb3Decision.slice(0, 10);
    const nominationTurn = buildInteractiveMockDraftState({
      ...inputs,
      commands,
      watchOwner: "Owner11",
      strategyKey: "three-rb",
      seed: "owner11-nomination-test",
    });
    const nominated = buildInteractiveMockDraftState({
      ...inputs,
      commands,
      watchOwner: "Owner11",
      strategyKey: "three-rb",
      seed: "owner11-nomination-test",
      nominatedPlayer: "Breece Hall",
      nominatedPrice: 3,
    });

    expect(nominationTurn).toMatchObject({
      phase: "human-nomination",
      nominator: "Owner11",
    });
    expect(nominated.nominator).toBe("Owner11");
    expect(nominated.nomination?.player).toBe("Breece Hall");
    expect(nominated.auction?.openingBid).toBe(3);
    expect(nominated.auction?.feed[0]?.text).toBe("Owner11 nominated Breece Hall for $3");
    expect(nominated.aiBids.length).toBeGreaterThan(0);
    expect(nominated.aiSaleCommand).toContain("Breece Hall");
    expect(["human-decision", "ai-sale"]).toContain(nominated.phase);

    const resolved = resolveInteractiveMockDraftAction(
      nominated,
      nominated.phase === "human-decision" ? "pass" : "advance",
    );
    expect(resolved.command).toBe(nominated.aiSaleCommand);
  });

  it("uses the selected owner in user-facing auction errors", async () => {
    const inputs = await loadInteractiveMockDraftInputs();
    const state = buildInteractiveMockDraftState({
      ...inputs,
      commands: [],
      watchOwner: "Owner02",
      strategyKey: "three-rb",
      seed: "owner-error-test",
    });
    const stateWithoutDecision = { ...state };
    delete stateWithoutDecision.nomination;
    delete stateWithoutDecision.camDecision;

    expect(() => resolveInteractiveMockDraftAction(
      stateWithoutDecision,
      "cam-bid",
    )).toThrow("Owner02 does not have a live decision to win.");
  });
});
