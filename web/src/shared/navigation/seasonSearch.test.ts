import { describe, expect, it } from "vitest";
import { searchForSeason } from "./seasonSearch";

describe("searchForSeason", () => {
  it("removes identifiers owned by the previous season", () => {
    const current = new URLSearchParams({
      runId: "run-a",
      seasonId: "season-a",
      sessionId: "mock-a",
      simulationRun: "4",
      strategy: "wr-heavy",
      view: "targets",
    });

    expect(searchForSeason(current, "season-b").toString()).toBe(
      "seasonId=season-b&strategy=wr-heavy&view=targets",
    );
    expect(current.get("seasonId")).toBe("season-a");
  });
});
