import { describe, expect, it } from "vitest";
import { buildLiveDraftMutation } from "./liveDraftMutation";

const context = { expectedRevision: 4, idempotencyKey: "key-1", roomId: "room-1" };

describe("buildLiveDraftMutation", () => {
  it("builds each lifecycle command", () => {
    const actions: ("start" | "pause" | "resume" | "reopen" | "undo")[] = [
      "start", "pause", "resume", "reopen", "undo",
    ];
    for (const action of actions) {
      expect(buildLiveDraftMutation({ action }, context)).toEqual({ action, ...context });
    }
  });

  it("builds sale, correction, and end commands", () => {
    expect(buildLiveDraftMutation({ action: "sales", command: "cam puka 62" }, context))
      .toEqual({ action: "sales", command: "cam puka 62", ...context });
    expect(buildLiveDraftMutation({
      action: "corrections",
      replacementSale: "seth puka 61",
      saleEventId: "sale-1",
    }, context)).toEqual({
      action: "corrections",
      replacementSale: "seth puka 61",
      saleEventId: "sale-1",
      ...context,
    });
    expect(buildLiveDraftMutation({ action: "end" }, context))
      .toEqual({ action: "end", ...context });
    expect(buildLiveDraftMutation({ action: "end", allowIncomplete: true }, context))
      .toEqual({ action: "end", allowIncomplete: true, ...context });
  });
});
