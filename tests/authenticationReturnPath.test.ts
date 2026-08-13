import { describe, expect, it } from "vitest";
import { sameOriginAuthenticationReturnPath } from "../src/platform/authenticationReturnPath.js";

describe("same-origin authentication return paths", () => {
  const origin = "https://mockd.example.com";

  it.each([
    "/\\evil.example/phish",
    "/%5Cevil.example/phish",
    "/%255Cevil.example/phish",
    "/%2525252525252525255Cevil.example/phish",
    "//evil.example/phish",
    "https://evil.example/phish",
  ])("rejects unsafe return path %s", candidate => {
    expect(sameOriginAuthenticationReturnPath(candidate, origin)).toBeUndefined();
  });

  it.each([
    ["/practice", "/practice"],
    ["/invite?token=league-invite", "/invite?token=league-invite"],
    ["/league?seasonId=season+2026#teams", "/league?seasonId=season+2026#teams"],
  ])("accepts local return path %s", (candidate, expected) => {
    expect(sameOriginAuthenticationReturnPath(candidate, origin)).toBe(expected);
  });
});
