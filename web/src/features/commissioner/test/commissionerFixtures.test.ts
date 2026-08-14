import { describe, expect, it } from "vitest";
import { ownerLeague, requestPath } from "./commissionerFixtures";

describe("commissioner test fixtures", () => {
  it("provides a manageable owner league", () => {
    expect(ownerLeague).toMatchObject({ canManageLeague: true, seasonId: "season-1" });
  });

  it("reads string, URL, and Request inputs", () => {
    expect(requestPath("/seasons/season-1")).toBe("/seasons/season-1");
    expect(requestPath(new URL("https://mockd.test/seasons/season-1"))).toBe(
      "https://mockd.test/seasons/season-1",
    );
    expect(requestPath(new Request("https://mockd.test/seasons/season-1"))).toBe(
      "https://mockd.test/seasons/season-1",
    );
  });
});
