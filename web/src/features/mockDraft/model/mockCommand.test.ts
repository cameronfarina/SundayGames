import { describe, expect, it } from "vitest";
import { mockCommand } from "./mockCommand.js";

describe("mockCommand", () => {
  it("adds the current revision to every user intent", () => {
    expect(mockCommand({ type: "start" }, 4)).toEqual({ type: "start", expectedRevision: 4 });
    expect(mockCommand({ type: "nominate", playerId: "gibbs" }, 4)).toEqual({
      type: "nominate",
      expectedRevision: 4,
      playerId: "gibbs",
    });
    expect(mockCommand({ type: "nominate", playerId: "gibbs", openingBid: 3 }, 4)).toEqual({
      type: "nominate",
      expectedRevision: 4,
      openingBid: 3,
      playerId: "gibbs",
    });
    expect(mockCommand({ type: "buy", price: 72 }, 4)).toEqual({
      type: "buy",
      expectedRevision: 4,
      price: 72,
    });
    expect(mockCommand({ type: "pass" }, 4)).toEqual({ type: "pass", expectedRevision: 4 });
    expect(mockCommand({ type: "undo" }, 4)).toEqual({ type: "undo", expectedRevision: 4 });
    expect(mockCommand({ type: "complete" }, 4)).toEqual({ type: "complete", expectedRevision: 4 });
  });
});
