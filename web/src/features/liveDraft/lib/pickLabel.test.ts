import { describe, expect, it } from "vitest";
import { liveDraftPickSchema } from "../api/liveDraftSchemas";
import { pickLabel } from "./pickLabel";

const pick = (round: number, pickInRound: number) => liveDraftPickSchema.parse({
  overall: (round - 1) * 12 + pickInRound,
  round,
  pickInRound,
  teamId: "team-1",
  ownerDisplayName: "Owner11",
  teamDisplayName: "Short King",
});

describe("pickLabel", () => {
  it("pads the slot so every pick lines up", () => {
    expect(pickLabel(pick(1, 1))).toBe("1.01");
    expect(pickLabel(pick(2, 12))).toBe("2.12");
    expect(pickLabel(pick(10, 3))).toBe("10.03");
  });
});
