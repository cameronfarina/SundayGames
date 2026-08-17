import { describe, expect, it } from "vitest";
import { ownerLeague, requestBody, requestPath } from "./commissionerFixtures";

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

  it("reads a string request body and ignores anything else", () => {
    expect(requestBody({ body: "{\"content\":\"rows\"}" })).toBe("{\"content\":\"rows\"}");
    expect(requestBody({ body: new URLSearchParams({ a: "b" }) })).toBe("");
    expect(requestBody()).toBe("");
  });
});
