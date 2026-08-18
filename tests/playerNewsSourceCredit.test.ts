import { describe, expect, it } from "vitest";
import { withoutSourceCredit } from "../src/modeling/playerNews/normalization.js";

// Every string below is real RotoWire copy pulled from the live NFL feed on
// 2026-08-17, so the rules are shaped by what the wire actually writes.
describe("player news source credit", () => {
  it("drops a trailing reporter credit", () => {
    expect(withoutSourceCredit(
      "Dobbins (undisclosed) participated in Monday's practice, Zac Stevens of TheDNVR.com reports.",
    )).toBe("Dobbins (undisclosed) participated in Monday's practice.");
    expect(withoutSourceCredit(
      "Waddle (leg) took part in Monday's practice, Parker Gabriel of The Denver Post reports.",
    )).toBe("Waddle (leg) took part in Monday's practice.");
  });

  it("keeps commas that belong to the sentence", () => {
    expect(withoutSourceCredit(
      "Coach Todd Bowles said Monday that Buccaneers starters, such as Irving, will play in Saturday's preseason game against the Chiefs, Greg Auman of Fox Sports reports.",
    )).toBe(
      "Coach Todd Bowles said Monday that Buccaneers starters, such as Irving, will play in Saturday's preseason game against the Chiefs.",
    );
  });

  it("drops a leading credit and restores the sentence", () => {
    expect(withoutSourceCredit(
      "Chad Graff of The Athletic predicts that Stevenson and TreVeyon Henderson are likely to share New England's backfield work pretty evenly this coming season.",
    )).toBe(
      "Stevenson and TreVeyon Henderson are likely to share New England's backfield work pretty evenly this coming season.",
    );
  });

  it("drops a per-outlet credit", () => {
    expect(withoutSourceCredit("Hall returned to team drills, per ESPN."))
      .toBe("Hall returned to team drills.");
    expect(withoutSourceCredit("Hall returned to team drills, according to The Athletic."))
      .toBe("Hall returned to team drills.");
  });

  it("leaves copy that carries no credit alone", () => {
    expect(withoutSourceCredit("Nacua (groin) may not practice this week."))
      .toBe("Nacua (groin) may not practice this week.");
    expect(withoutSourceCredit("")).toBe("");
  });
});
