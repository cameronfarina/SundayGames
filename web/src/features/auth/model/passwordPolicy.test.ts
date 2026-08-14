import { describe, expect, it } from "vitest";
import { minimumPasswordCharacters } from "./passwordPolicy";

describe("password policy", () => {
  it("requires at least 15 characters", () => {
    expect(minimumPasswordCharacters).toBe(15);
  });
});
