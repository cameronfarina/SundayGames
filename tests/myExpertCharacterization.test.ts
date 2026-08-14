import { describe, expect, it } from "vitest";
import * as myExpert from "../src/modeling/myExpert.js";

describe("my expert public behavior", () => {
  it("keeps one runtime export", () => {
    expect(Object.keys(myExpert)).toEqual(["buildMyExpertAdvice"]);
  });

  it("orders every advice category deterministically", () => {
    const advice = myExpert.buildMyExpertAdvice({
      currentWeek: 1,
      leagueSettings: {
        lineup: { RB: 1, FLEX: 1 },
        rosterMaximums: { RB: 3, WR: 3 },
      },
      roster: [
        {
          id: "bye-running-back",
          name: "Bye Running Back",
          position: "RB",
          projectedPoints: 10,
          rosteredRole: "starter",
          byeWeek: 2,
        },
        {
          id: "flex-starter",
          name: "Flex Starter",
          position: "WR",
          projectedPoints: 12,
          rosteredRole: "starter",
        },
        {
          id: "bench-running-back",
          name: "Bench Running Back",
          position: "RB",
          projectedPoints: 8,
          rosteredRole: "bench",
          byeWeek: 2,
        },
        {
          id: "bench-wideout",
          name: "Bench Wideout",
          position: "WR",
          projectedPoints: 6,
          rosteredRole: "bench",
        },
      ],
      availablePlayers: [
        {
          id: "bye-cover",
          name: "Bye Cover",
          position: "RB",
          projectedPoints: 15,
          byeWeek: 8,
        },
      ],
      matchups: [],
      news: [
        {
          playerId: "flex-starter",
          headline: "Flex Starter missed practice.",
          impact: "watch",
          severity: 2,
        },
      ],
      tradeCandidates: [
        {
          id: "elite-running-back",
          name: "Elite Running Back",
          position: "RB",
          projectedPoints: 20,
          acquisitionCost: "fair",
        },
      ],
    });

    expect(advice.currentWeek).toBe(1);
    expect(advice.cards.map(card => card.id)).toEqual([
      "lineup-advisor-week-1",
      "add-drop-bye-cover-bench-wideout",
      "bye-coverage-week-2-rb-bye-cover",
      "injury-watch-flex-starter",
      "trade-target-elite-running-back",
    ]);
    expect(advice.cards.map(card => card.type)).toEqual([
      "lineup",
      "add-drop",
      "bye-coverage",
      "injury-watch",
      "trade-target",
    ]);
    expect(advice.cards[0]?.lineup?.flexChoice.name).toBe("Flex Starter");
    expect(advice.policy).toEqual({
      mode: "read-only",
      allowedActions: ["recommend"],
      blockedActions: ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"],
    });
  });
});
