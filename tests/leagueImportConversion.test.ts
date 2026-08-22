import { describe, expect, it } from "vitest";
import type {
  SyncedLeagueSettings,
  SyncedTeam,
} from "../src/data/leagueSyncProviderAdapters.js";
import {
  leagueImportConversion,
  type LeagueImportSource,
} from "../src/platform/leagueImportFromSync.js";

const teamsFor = (count: number): readonly SyncedTeam[] =>
  Array.from({ length: count }, (_unused, index) => ({
    providerTeamId: String(index + 1),
    name: `Team ${index + 1}`,
    ownerNames: [`Owner ${index + 1}`],
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    players: [],
  }));

const espnSettings: SyncedLeagueSettings = {
  name: "Pigskin Power Bottoms",
  season: "2025",
  teamCount: 4,
  rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "DST", "K", "BN", "BN", "IR"],
  scoring: { pass_yd: 0.04, pass_td: 4, rush_yd: 0.1, rec_yd: 0.1, rec_td: 6, rec: 1 },
  draftType: "auction",
  auctionBudget: 200,
  keeperCount: 2,
};

const sleeperSettings: SyncedLeagueSettings = {
  name: "Sleeper Friends League",
  season: "2018",
  teamCount: 4,
  rosterPositions: ["QB", "RB", "RB", "WR", "FLEX", "DEF", "K", "BN", "BN", "TAXI", "IR"],
  scoring: { rec: 1, pass_td: 4, rush_td: 6, rec_td: 6 },
  draftType: "snake",
  snakeRounds: 9,
  keeperCount: 0,
};

const espnSource: LeagueImportSource = {
  provider: "espn",
  providerLeagueId: "899513",
  settings: espnSettings,
  teams: teamsFor(4),
};

const sleeperSource: LeagueImportSource = {
  provider: "sleeper",
  providerLeagueId: "289646328504385536",
  settings: sleeperSettings,
  teams: teamsFor(4),
};

const blockedIssues = (source: LeagueImportSource): readonly string[] => {
  const conversion = leagueImportConversion(source);
  if (conversion.status === "ready") throw new Error("Expected the conversion to be blocked.");
  return conversion.issues;
};

const readyInput = (source: LeagueImportSource) => {
  const conversion = leagueImportConversion(source);
  if (conversion.status === "blocked") {
    throw new Error(`Expected a ready conversion, got: ${conversion.issues.join(" ")}`);
  }
  return conversion.input;
};

describe("league import conversion", () => {
  it("builds an auction league out of an ESPN snapshot", () => {
    const input = readyInput(espnSource);

    expect(input).toMatchObject({
      provider: "espn",
      externalLeagueId: "899513",
      leagueName: "Pigskin Power Bottoms",
      seasonYear: 2025,
      expectedTeamCount: 4,
      keeperLeague: true,
      draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
    });
    expect(input.scoring).toEqual({
      passingYards: 0.04,
      passingTouchdown: 4,
      rushingYards: 0.1,
      // ESPN scores no rushing touchdown here, so the standard value fills in.
      rushingTouchdown: 6,
      receivingYards: 0.1,
      receivingTouchdown: 6,
      reception: 1,
    });
    expect(input.rosterSlots).toEqual({
      QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1, BENCH: 2, IR: 1,
    });
    expect(input.teams[0]).toEqual({
      externalTeamId: "1",
      displayName: "Team 1",
      managerNames: ["Owner 1"],
    });
  });

  it("builds a snake league out of a Sleeper snapshot and drops the taxi squad", () => {
    const input = readyInput(sleeperSource);

    expect(input.draft).toEqual({
      type: "snake",
      rounds: 9,
      order: ["1", "2", "3", "4"],
    });
    // DEF is Sleeper's name for a defence, and the taxi squad has no home here.
    expect(input.rosterSlots).toEqual({ QB: 1, RB: 2, WR: 1, FLEX: 1, DST: 1, K: 1, BENCH: 2, IR: 1 });
    expect(input.keeperLeague).toBe(false);
  });

  it("drafts the whole roster when the provider names no round count", () => {
    const { snakeRounds: _unused, ...settings } = sleeperSettings;

    const input = readyInput({ ...sleeperSource, settings });

    // Nine draftable slots: the IR slot is not one of them.
    expect(input.draft).toMatchObject({ type: "snake", rounds: 9 });
  });

  it("names the roster slot it cannot fill instead of inventing one", () => {
    const issues = blockedIssues({
      ...espnSource,
      settings: { ...espnSettings, rosterPositions: [...espnSettings.rosterPositions, "HC"] },
    });

    expect(issues).toEqual(["ESPN roster slot HC is not supported."]);
  });

  it("stops when the provider never says how the league drafts", () => {
    const { draftType: _unused, ...settings } = espnSettings;

    expect(leagueImportConversion({ ...espnSource, settings })).toEqual({
      status: "blocked",
      issues: ["ESPN did not include this league's draft format."],
      draftSetup: {
        auctionBudgetDollars: 200,
        minimumBidDollars: 1,
        snakeRounds: 11,
      },
    });
  });

  it("stops when an auction budget cannot cover the minimum bid for every slot", () => {
    const issues = blockedIssues({
      ...espnSource,
      settings: { ...espnSettings, auctionBudget: 5, minimumBid: 2 },
    });

    expect(issues).toEqual([
      "The $5 auction budget cannot cover a $2 minimum bid for all 11 roster slots.",
    ]);
  });

  it("stops when a touchdown is worth nothing rather than quietly repricing it", () => {
    const issues = blockedIssues({
      ...espnSource,
      settings: { ...espnSettings, scoring: { ...espnSettings.scoring, pass_td: 0 } },
    });

    expect(issues).toEqual([
      "A passing touchdown scores 0 points in this league, and Sunday Games needs it above zero.",
    ]);
  });

  it("reports every problem at once so the owner fixes them in one pass", () => {
    const issues = blockedIssues({
      ...espnSource,
      settings: {
        ...espnSettings,
        season: "twenty twenty five",
        teamCount: 2,
        rosterPositions: [...espnSettings.rosterPositions, "HC"],
      },
    });

    expect(issues).toEqual([
      "ESPN roster slot HC is not supported.",
      "ESPN did not name the season this league plays in.",
      "This league has 2 teams, and Sunday Games leagues run 4 to 20.",
    ]);
  });
});
