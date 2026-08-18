import { describe, expect, it } from "vitest";
import { minimumPasswordCharacters } from "./passwordPolicy";

describe("password policy", () => {
  it("requires at least 6 characters", () => {
    expect(minimumPasswordCharacters).toBe(6);
  });
});
