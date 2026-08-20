import { describe, expect, it } from "vitest";
import {
  minimumPasswordCharacters,
  passwordInputPattern,
  passwordRequirements,
} from "./passwordPolicy";

describe("password policy", () => {
  it("requires at least 6 characters", () => {
    expect(minimumPasswordCharacters).toBe(6);
  });

  it("requires an ASCII number and a punctuation or symbol character", () => {
    const policy = new RegExp(`^(?:${passwordInputPattern})$`, "v");

    expect(passwordRequirements).toBe(
      "Use at least 6 characters, including a number (0–9) and a punctuation or symbol character.",
    );
    expect(policy.test("abcdef!")).toBe(false);
    expect(policy.test("abcdef1")).toBe(false);
    expect(policy.test("abcde1 ")).toBe(false);
    expect(policy.test("ab 12!")).toBe(true);
    expect(policy.test("abcd١!")).toBe(false);
  });
});
