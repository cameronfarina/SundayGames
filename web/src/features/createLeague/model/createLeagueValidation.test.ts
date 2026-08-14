import { describe, expect, it } from "vitest";
import { createInitialLeagueDraft, leagueDraftReducer } from "./createLeagueDraft";
import {
  basicsErrors,
  createLeagueSetup,
  isLeagueDraftComplete,
  rosterErrors,
  scoringErrors,
  teamErrors,
} from "./createLeagueValidation";

const completedDraft = () => {
  let draft = createInitialLeagueDraft(2026);
  draft = leagueDraftReducer(draft, { type: "set-league-name", value: "Sunday Games" });
  draft = leagueDraftReducer(draft, { type: "set-team-count", value: 2 });
  draft = leagueDraftReducer(draft, { type: "choose-manual" });
  draft = leagueDraftReducer(draft, {
    type: "set-team-field", index: 0, field: "displayName", value: "Short King",
  });
  draft = leagueDraftReducer(draft, {
    type: "set-team-field", index: 1, field: "displayName", value: "Dart Vader",
  });
  return draft;
};

describe("create league validation", () => {
  it("reports invalid basics, scoring, roster, and team names", () => {
    let draft = createInitialLeagueDraft(2026);
    draft = leagueDraftReducer(draft, { type: "set-season", value: 0 });
    draft = leagueDraftReducer(draft, { type: "set-team-count", value: 1 });
    draft = leagueDraftReducer(draft, { type: "set-auction-budget", value: 0 });
    draft = leagueDraftReducer(draft, { type: "set-minimum-bid", value: -1 });
    draft = leagueDraftReducer(draft, { type: "set-scoring", field: "reception", value: Number.NaN });
    draft = leagueDraftReducer(draft, { type: "set-roster", slot: "QB", value: -1 });
    draft = leagueDraftReducer(draft, { type: "set-roster", slot: "RB", value: 0 });
    draft = leagueDraftReducer(draft, { type: "set-roster", slot: "WR", value: 0 });
    draft = leagueDraftReducer(draft, { type: "set-roster", slot: "TE", value: 0 });
    draft = leagueDraftReducer(draft, { type: "set-roster", slot: "FLEX", value: 0 });
    draft = leagueDraftReducer(draft, { type: "set-roster", slot: "DST", value: 0 });
    draft = leagueDraftReducer(draft, { type: "set-roster", slot: "K", value: 0 });
    draft = leagueDraftReducer(draft, { type: "set-roster", slot: "BENCH", value: 0 });

    expect(basicsErrors(draft)).toEqual({
      leagueName: "Enter a league name.",
      seasonYear: "Enter a valid season.",
      teamCount: "Use between 2 and 20 teams.",
      auctionBudget: "Enter a positive auction budget.",
      minimumBid: "Enter a positive minimum bid.",
    });
    expect(scoringErrors(draft)).toEqual({ reception: "Enter a valid point value." });
    expect(rosterErrors(draft)).toEqual({
      QB: "Use a non-negative whole number.",
      roster: "Add at least one draftable roster slot.",
    });
    expect(teamErrors(draft)).toEqual(["Enter a team name."]);
    expect(isLeagueDraftComplete(draft)).toBe(false);
  });

  it("builds an exact auction setup payload", () => {
    const draft = completedDraft();

    expect(isLeagueDraftComplete(draft)).toBe(true);
    expect(createLeagueSetup(draft)).toEqual({
      provider: "mockd",
      externalLeagueId: "mockd-2026-sunday-games",
      leagueName: "Sunday Games",
      seasonYear: 2026,
      expectedTeamCount: 2,
      teams: [
        { externalTeamId: "1", displayName: "Short King" },
        { externalTeamId: "2", displayName: "Dart Vader" },
      ],
      draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
      scoring: draft.scoring,
      rosterSlots: draft.roster,
    });
  });

  it("normalizes optional team values and creates snake order", () => {
    let draft = completedDraft();
    draft = leagueDraftReducer(draft, { type: "set-draft-type", value: "snake" });
    draft = leagueDraftReducer(draft, {
      type: "set-team-field", index: 0, field: "managerNames", value: "Owner11, Manager11",
    });
    draft = leagueDraftReducer(draft, {
      type: "set-team-field", index: 0, field: "abbreviation", value: " OWN11 ",
    });

    const setup = createLeagueSetup(draft);
    expect(setup.teams[0]).toEqual({
        externalTeamId: "1",
        displayName: "Short King",
        managerNames: ["Owner11", "Manager11"],
        abbreviation: "OWN11",
    });
    expect(setup).toMatchObject({
      draft: { type: "snake", rounds: 16, order: ["1", "2"], reversal: "standard" },
    });

    const rosterRounds = createLeagueSetup({ ...draft, snakeRounds: 0 });
    expect(rosterRounds).toMatchObject({ draft: { type: "snake", rounds: 16 } });
  });

  it("preserves the ESPN identity in an imported setup", () => {
    let draft = completedDraft();
    draft = { ...draft, referenceMode: "imported", externalLeagueId: "100001" };

    expect(createLeagueSetup(draft)).toMatchObject({
      provider: "espn",
      externalLeagueId: "100001",
    });
  });
});
