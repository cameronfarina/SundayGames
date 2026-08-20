import { describe, expect, it } from "vitest";
import { coverflowPlacement, firstActiveIndex, lastActiveIndex } from "./coverflowPlacement";

describe("coverflowPlacement", () => {
  it.each([
    { activeIndex: 2, expected: "center", index: 2 },
    { activeIndex: 2, expected: "previous", index: 1 },
    { activeIndex: 2, expected: "next", index: 3 },
    { activeIndex: 2, expected: "far-previous", index: 0 },
    { activeIndex: 2, expected: "far-next", index: 4 },
  ])("places index $index as $expected", ({ activeIndex, expected, index }) => {
    expect(coverflowPlacement(index, activeIndex)).toBe(expected);
  });

  it("keeps a neighbour on each side of the centre card", () => {
    expect(firstActiveIndex).toBe(1);
    expect(lastActiveIndex(5)).toBe(3);
  });
});
