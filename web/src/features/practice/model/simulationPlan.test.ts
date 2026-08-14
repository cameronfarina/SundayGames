import { describe, expect, it } from "vitest";
import { formText, simulationStrategyText } from "./simulationPlan";
import type { PracticeShortlistItem } from "../api/practiceContextSchema";

const target = (playerName: string, maxBid?: number): PracticeShortlistItem => ({
  createdAt: "2026-08-13T12:00:00.000Z",
  id: `target-${playerName}`,
  leagueId: "league-1",
  playerName,
  position: "RB",
  priority: 1,
  seasonId: "season-1",
  updatedAt: "2026-08-13T12:00:00.000Z",
  userId: "user-1",
  ...(maxBid === undefined ? {} : { maxBid }),
});

describe("simulation strategy plan", () => {
  it("reads trimmed text while rejecting absent and file form values", () => {
    const data = new FormData();
    data.set("text", "  hello  ");
    data.set("file", new File(["data"], "draft.csv"));
    expect(formText(data, "text")).toBe("hello");
    expect(formText(data, "missing")).toBe("");
    expect(formText(data, "file")).toBe("");
  });

  it("turns shortlist targets and caps into engine-readable instructions", () => {
    expect(simulationStrategyText([
      target("Jadarian Price", 15),
      target("Ja'Marr Chase"),
    ], "Do not spend over $25 on another WR.")).toBe(
      "Draft Jadarian Price for no more than $15. Draft Ja'Marr Chase. Do not spend over $25 on another WR.",
    );
  });

  it("preserves additional instructions when no targets exist", () => {
    expect(simulationStrategyText([], "Prioritize Week 1 scoring.")).toBe("Prioritize Week 1 scoring.");
    expect(simulationStrategyText([], "   ")).toBe("");
  });
});
