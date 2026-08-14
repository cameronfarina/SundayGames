import { describe, expect, it } from "vitest";
import { invitationTokenFromReturnTo, safeReturnPath } from "./authNavigation";

describe("auth navigation", () => {
  it.each([
    [null, "/practice"],
    ["https://attacker.example", "/practice"],
    ["//attacker.example/path", "/practice"],
    ["/\\attacker.example/path", "/practice"],
    ["practice", "/practice"],
    ["/league?seasonId=season-1", "/league?seasonId=season-1"],
  ])("normalizes %s to %s", (candidate, expected) => {
    expect(safeReturnPath(candidate)).toBe(expected);
  });

  it("reads invitation tokens only from safe invitation return paths", () => {
    expect(invitationTokenFromReturnTo("/invite?token=league-token")).toBe("league-token");
    expect(invitationTokenFromReturnTo("/practice?token=wrong-place")).toBeUndefined();
    expect(invitationTokenFromReturnTo("/invite")).toBeUndefined();
    expect(invitationTokenFromReturnTo("//attacker.example/invite?token=stolen")).toBeUndefined();
  });
});
