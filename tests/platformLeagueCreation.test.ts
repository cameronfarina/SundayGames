import { describe, expect, it } from "vitest";

import { createLeagueSeasonFromConfirmedSetup } from "../src/platform/leagueCreation.js";
import { defaultScoringSettings } from "../src/platform/leagueSeason.js";

describe("confirmed league creation", () => {
  it("creates an auction season with only server-owned identifiers", () => {
    let nextId = 0;
    const season = createLeagueSeasonFromConfirmedSetup({
      provider: "espn",
      externalLeagueId: "214674",
      leagueName: "The Sunday Games",
      seasonYear: 2026,
      expectedTeamCount: 4,
      teams: [
        { externalTeamId: "7", displayName: "Short King", managerNames: ["Cam"] },
        { externalTeamId: "4", displayName: "Dart Vader", managerNames: ["Beaton"] },
        { externalTeamId: "8", displayName: "Third Team", managerNames: ["Sam"] },
        { externalTeamId: "9", displayName: "Fourth Team", managerNames: ["Nick"] },
      ],
      draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
      scoring: { ...defaultScoringSettings },
      rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 7 },
    }, () => `generated-${++nextId}`);

    expect(season).toMatchObject({
      id: "season-generated-2",
      leagueId: "league-generated-1",
      league: {
        id: "league-generated-1",
        externalLeagueId: "214674",
        name: "The Sunday Games",
        provider: "espn",
      },
      seasonYear: 2026,
      setupStatus: "draft",
      settings: {
        draftFormat: "auction",
        expectedTeamCount: 4,
        auction: { budgetDollars: 200, minimumBidDollars: 1 },
        scoring: { reception: 0.5, passingTouchdown: 4 },
        roster: {
          rosterSize: 16,
          lineupSlotCount: 16,
          rosterMaximums: { QB: 8, RB: 10, WR: 10, TE: 9, K: 8, DST: 8 },
        },
      },
    });
    expect(season.teams).toHaveLength(4);
    expect(season.teams).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "team-generated-3",
        ownerId: "owner-generated-4",
        displayName: "Short King",
        managerDisplayNames: ["Cam"],
        draftOrderPosition: 1,
      }),
      expect.objectContaining({
        id: "team-generated-5",
        ownerId: "owner-generated-6",
        displayName: "Dart Vader",
        managerDisplayNames: ["Beaton"],
        draftOrderPosition: 2,
      }),
    ]));
  });

  it("derives draft capacity and position maxima from canonical hybrid slots", () => {
    let nextId = 0;
    const season = createLeagueSeasonFromConfirmedSetup({
      provider: "espn",
      externalLeagueId: "88",
      leagueName: "Hybrid League",
      seasonYear: 2026,
      expectedTeamCount: 4,
      teams: [
        { externalTeamId: "1", displayName: "First" },
        { externalTeamId: "2", displayName: "Second" },
        { externalTeamId: "3", displayName: "Third" },
        { externalTeamId: "4", displayName: "Fourth" },
      ],
      draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
      scoring: { ...defaultScoringSettings },
      rosterSlots: {
        QB: 1,
        RB: 1,
        WR: 1,
        TE: 1,
        SUPERFLEX: 1,
        RB_WR: 1,
        WR_TE: 1,
        FLEX: 1,
        K: 1,
        DST: 1,
        BENCH: 2,
        IR: 3,
      },
    }, () => `generated-${++nextId}`);

    expect(season.settings.roster).toEqual({
      rosterSize: 12,
      lineup: {
        QB: 1,
        RB: 1,
        WR: 1,
        TE: 1,
        SUPERFLEX: 1,
        RB_WR: 1,
        WR_TE: 1,
        FLEX: 1,
        K: 1,
        DST: 1,
        BENCH: 2,
      },
      lineupSlotCount: 12,
      rosterMaximums: { QB: 4, RB: 6, WR: 7, TE: 6, K: 3, DST: 3 },
    });
  });

  it("rejects unknown roster slots instead of treating them as universal", () => {
    expect(() => createLeagueSeasonFromConfirmedSetup({
      provider: "mockd",
      externalLeagueId: "unknown-slot",
      leagueName: "Unknown Slot League",
      seasonYear: 2026,
      expectedTeamCount: 4,
      teams: [
        { externalTeamId: "1", displayName: "First" },
        { externalTeamId: "2", displayName: "Second" },
        { externalTeamId: "3", displayName: "Third" },
        { externalTeamId: "4", displayName: "Fourth" },
      ],
      draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
      scoring: { ...defaultScoringSettings },
      rosterSlots: { QB: 1, MYSTERY: 1, BENCH: 1 },
    })).toThrow("Unsupported roster slot MYSTERY. Review the roster settings before continuing.");
  });

  it("translates an external snake order into internal team ids", () => {
    let nextId = 0;
    const season = createLeagueSeasonFromConfirmedSetup({
      provider: "espn",
      externalLeagueId: "99",
      leagueName: "Snake League",
      seasonYear: 2026,
      expectedTeamCount: 4,
      teams: [
        { externalTeamId: "4", displayName: "Fourth" },
        { externalTeamId: "7", displayName: "Seventh" },
        { externalTeamId: "8", displayName: "Eighth" },
        { externalTeamId: "9", displayName: "Ninth" },
      ],
      draft: { type: "snake", rounds: 15, order: ["7", "4", "9", "8"], reversal: "standard" },
      scoring: { ...defaultScoringSettings, reception: 1, passingTouchdown: 6 },
      rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, BENCH: 8 },
    }, () => `generated-${++nextId}`);

    expect(season.settings).toMatchObject({
      draftFormat: "snake",
      snake: {
        rounds: 15,
        reversal: "standard",
        order: ["team-generated-5", "team-generated-3", "team-generated-9", "team-generated-7"],
      },
    });
  });

  it("rejects unconfirmed or internally inconsistent setup data", () => {
    expect(() => createLeagueSeasonFromConfirmedSetup({
      provider: "mockd",
      externalLeagueId: "",
      leagueName: " ",
      seasonYear: 2026,
      expectedTeamCount: 2,
      teams: [{ externalTeamId: "1", displayName: "Only one" }],
      draft: { type: "auction", budgetDollars: 0, minimumBidDollars: 1 },
      scoring: { ...defaultScoringSettings },
      rosterSlots: { QB: 1 },
    })).toThrow("League name is required");
  });
});
