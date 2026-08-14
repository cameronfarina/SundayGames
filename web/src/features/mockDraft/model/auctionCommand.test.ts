import { describe, expect, it } from "vitest";
import { auctionCommand } from "./auctionCommand.js";

describe("auctionCommand", () => {
  it("adds the current revision to every user intent", () => {
    expect(auctionCommand({ type: "start" }, 4)).toEqual({ type: "start", expectedRevision: 4 });
    expect(auctionCommand({ type: "nominate", playerId: "gibbs" }, 4)).toEqual({
      type: "nominate",
      expectedRevision: 4,
      playerId: "gibbs",
    });
    expect(auctionCommand({ type: "nominate", playerId: "gibbs", openingBid: 3 }, 4)).toEqual({
      type: "nominate",
      expectedRevision: 4,
      openingBid: 3,
      playerId: "gibbs",
    });
    expect(auctionCommand({ type: "buy", price: 72 }, 4)).toEqual({
      type: "buy",
      expectedRevision: 4,
      price: 72,
    });
    expect(auctionCommand({ type: "pass" }, 4)).toEqual({ type: "pass", expectedRevision: 4 });
    expect(auctionCommand({ type: "undo" }, 4)).toEqual({ type: "undo", expectedRevision: 4 });
    expect(auctionCommand({ type: "complete" }, 4)).toEqual({ type: "complete", expectedRevision: 4 });
  });
});
