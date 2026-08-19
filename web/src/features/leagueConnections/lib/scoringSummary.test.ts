import { describe, expect, it } from "vitest";
import { describeScoringRules, summarizeScoring } from "./scoringSummary";

describe("scoring summary", () => {
  it("leads with the rules a manager compares leagues on, in reading order", () => {
    const summary = summarizeScoring({ pass_td: 4, rec: 1, rush_yd: 0.1, sack: 1 });

    expect(describeScoringRules(summary.headline))
      .toBe("Reception 1 · Passing TD 4 · Rushing yard 0.1");
  });

  it("skips headline rules the provider did not report", () => {
    const summary = summarizeScoring({ pass_td: 6 });

    expect(summary.headline).toEqual([{ label: "Passing TD", points: 6 }]);
  });

  it("keeps every rule available, alphabetized, with provider keys made readable", () => {
    const summary = summarizeScoring({ pts_allow_35p: -4, fgm_40_49: 4, rec: 0.5 });

    expect(describeScoringRules(summary.all))
      .toBe("Fgm 40 49 4 · Pts allow 35p -4 · Reception 0.5");
  });

  it("reports nothing for a league that shipped no scoring", () => {
    const summary = summarizeScoring({});

    expect(summary).toEqual({ all: [], headline: [] });
  });
});
