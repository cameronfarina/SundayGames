import { describe, expect, it } from "vitest";
import { maximumDisplayNameCharacters } from "./displayNamePolicy";

describe("display name policy", () => {
  it("allows at most 40 characters", () => {
    expect(maximumDisplayNameCharacters).toBe(40);
  });
});
