import { describe, expect, it } from "vitest";
import { snakeCommandSchema, snakeStateSchema } from "./snakeStateSchemas.js";
import { snakeMockResponseFixture } from "../test/snakeMockResponseFixture.js";

describe("snakeStateSchemas", () => {
  it("accepts the state the season mock endpoint returns", () => {
    expect(() => snakeStateSchema.parse(snakeMockResponseFixture().state)).not.toThrow();
  });

  it("rejects a board pick whose round is not positive", () => {
    const { state } = snakeMockResponseFixture();
    const [first, ...rest] = state.board.picks;
    if (first === undefined) throw new Error("Expected a fixture pick.");
    expect(() => snakeStateSchema.parse({
      ...state,
      board: { ...state.board, picks: [{ ...first, round: 0 }, ...rest] },
    })).toThrow();
  });

  it("accepts every snake command and rejects an auction bid", () => {
    expect(snakeCommandSchema.parse({ type: "pick", expectedRevision: 3, playerId: "chase" }))
      .toEqual({ type: "pick", expectedRevision: 3, playerId: "chase" });
    expect(() => snakeCommandSchema.parse({ type: "buy", expectedRevision: 3, price: 40 })).toThrow();
  });
});
