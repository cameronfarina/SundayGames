import { describe, expect, it } from "vitest";
import { importedReviewFixture } from "../test/importedReviewFixture";
import {
  createInitialLeagueDraft,
  type LeagueDraftAction,
  leagueDraftReducer,
} from "./createLeagueDraft";
import type { EspnSettingsReview } from "./createLeagueTypes";

describe("leagueDraftReducer", () => {
  it("preserves entered values while navigating between steps", () => {
    const initial = createInitialLeagueDraft(2026);
    const named = leagueDraftReducer(initial, { type: "set-league-name", value: "Sunday Games" });
    const advanced = leagueDraftReducer(named, { type: "go-to-step", step: "reference" });

    expect(advanced.leagueName).toBe("Sunday Games");
    expect(advanced.step).toBe("reference");
    expect(leagueDraftReducer(advanced, { type: "go-to-step", step: "basics" }).leagueName)
      .toBe("Sunday Games");
  });

  it("resizes teams without losing names that still fit", () => {
    const initial = createInitialLeagueDraft(2026);
    const firstName = leagueDraftReducer(initial, {
      type: "set-team-field",
      index: 0,
      field: "displayName",
      value: "Short King",
    });
    const resized = leagueDraftReducer(firstName, { type: "set-team-count", value: 4 });

    expect(resized.teams).toHaveLength(4);
    expect(resized.teams[0]?.displayName).toBe("Short King");
    expect(leagueDraftReducer(resized, { type: "set-team-count", value: 6 }).teams[5])
      .toMatchObject({ externalTeamId: "6", displayName: "" });
    expect(leagueDraftReducer(resized, { type: "set-team-count", value: Number.NaN }).teams)
      .toEqual([]);
  });

  it("accepts a reviewed ESPN setup and keeps imported values editable", () => {
    const accepted = leagueDraftReducer(createInitialLeagueDraft(2026), {
      type: "accept-import",
      review: importedReviewFixture.review,
    });

    expect(accepted).toMatchObject({
      leagueName: "The League",
      seasonYear: 2026,
      teamCount: 2,
      draftType: "auction",
      referenceMode: "imported",
      externalLeagueId: "100001",
      scoring: { reception: 0.5 },
      roster: { QB: 1, BENCH: 7 },
    });
    expect(accepted.teams.map(team => team.displayName)).toEqual(["Short King", "Dart Vader"]);
  });

  it("updates every editable setup group", () => {
    const actions: readonly LeagueDraftAction[] = [
      { type: "set-season", value: 2027 },
      { type: "set-draft-type", value: "snake" },
      { type: "set-auction-budget", value: 250 },
      { type: "set-minimum-bid", value: 2 },
      { type: "set-reference-source", value: "https://fantasy.espn.com/?leagueId=8" },
      { type: "choose-manual" },
      { type: "set-scoring", field: "reception", value: 1 },
      { type: "set-roster", slot: "RB", value: 3 },
    ];
    const result = actions.reduce(leagueDraftReducer, createInitialLeagueDraft(2026));

    expect(result).toMatchObject({
      seasonYear: 2027,
      draftType: "snake",
      auctionBudget: 250,
      minimumBid: 2,
      referenceSource: "https://fantasy.espn.com/?leagueId=8",
      referenceMode: "manual",
      scoring: { reception: 1 },
      roster: { RB: 3 },
    });
  });

  it("uses safe defaults for optional values in a snake import", () => {
    const review: EspnSettingsReview = {
      externalLeagueId: "8", season: 2027, leagueName: null, teamCount: 1,
      draft: { type: "snake", rounds: 12, order: ["1"] },
      scoring: importedReviewFixture.review.scoring,
      rosterSlots: {},
      teams: [{
        externalTeamId: "1", displayName: "One", abbreviation: null, draftOrderPosition: 1,
      }],
    };
    const initial = leagueDraftReducer(createInitialLeagueDraft(2026), {
      type: "set-league-name", value: "Fallback",
    });
    const accepted = leagueDraftReducer(initial, { type: "accept-import", review });

    expect(accepted).toMatchObject({
      leagueName: "Fallback", draftType: "snake", snakeRounds: 12,
      roster: { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, DST: 0, K: 0, BENCH: 0 },
      teams: [{ abbreviation: "" }],
    });
  });
});
