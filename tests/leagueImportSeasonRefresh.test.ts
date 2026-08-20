import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { ConfirmedLeagueCreationInput } from "../src/platform/leagueCreation.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type { LeagueSeason, LeagueSeasonSetupStatus } from "../src/platform/leagueSeason.js";
import {
  refreshedSeasonFromImport,
  seasonFromLeagueImport,
} from "../src/platform/leagueImportFromSync.js";

const teamCount = 4;

const seasonFixture = (setupStatus: LeagueSeasonSetupStatus): LeagueSeason =>
  buildCurrentMockdLeagueSeason(ownerOrder.slice(0, teamCount), {
    ...leagueConfig,
    teams: teamCount,
  }, { leagueName: "Hand-Made League", seasonYear: 2026, setupStatus });

const importedInput = (
  managerNames: readonly string[],
): ConfirmedLeagueCreationInput => ({
  provider: "sleeper",
  externalLeagueId: "289646328504385536",
  leagueName: "Sleeper Friends League",
  seasonYear: 2026,
  expectedTeamCount: teamCount,
  keeperLeague: false,
  teams: managerNames.map((manager, index) => ({
    externalTeamId: String(index + 1),
    displayName: `Provider Team ${index + 1}`,
    managerNames: [manager],
  })),
  draft: { type: "snake", rounds: 6, order: ["1", "2", "3", "4"] },
  scoring: {
    passingYards: 0.04,
    passingTouchdown: 4,
    rushingYards: 0.1,
    rushingTouchdown: 6,
    receivingYards: 0.1,
    receivingTouchdown: 6,
    reception: 1,
  },
  rosterSlots: { QB: 1, RB: 2, WR: 1, FLEX: 1, K: 1, BENCH: 1 },
});

const managersOf = (season: LeagueSeason): readonly string[] =>
  season.teams.map(team => team.ownerDisplayName);

describe("imported league season refresh", () => {
  it("keeps a manager's team id even when the provider reorders the league", () => {
    const season = seasonFixture("draft");
    const reordered = [...managersOf(season)].reverse();

    const rewritten = seasonFromLeagueImport(season, importedInput(reordered));

    // Matching by manager first means a reordered provider list does not hand
    // one owner another owner's team, keepers and all.
    expect(rewritten.teams.map(team => team.ownerDisplayName)).toEqual(reordered);
    expect(rewritten.teams.map(team => team.id))
      .toEqual([...season.teams].reverse().map(team => team.id));
    expect(rewritten.teams.map(team => team.ownerId))
      .toEqual([...season.teams].reverse().map(team => team.ownerId));
  });

  it("rewrites everything a draft season is still free to change", () => {
    const season = seasonFixture("draft");

    const refresh = refreshedSeasonFromImport(season, importedInput(managersOf(season)));
    if (refresh.status === "blocked") throw new Error(refresh.detail);

    expect(refresh.season.league.name).toBe("Sleeper Friends League");
    expect(refresh.season.settings.draftFormat).toBe("snake");
    expect(refresh.detail).toBeUndefined();
  });

  it("leaves a published season's draft alone and says why", () => {
    const season = seasonFixture("published");

    const refresh = refreshedSeasonFromImport(season, importedInput(managersOf(season)));
    if (refresh.status === "blocked") throw new Error(refresh.detail);

    // The season was built as an auction; the provider now runs a snake draft.
    expect(refresh.season.settings.draftFormat).toBe("auction");
    expect(refresh.season.settings.auction).toEqual(season.settings.auction);
    expect(refresh.detail).toBe(
      "This league now runs a snake draft at the provider. " +
      "Sunday Games kept the draft this season was published with.",
    );
    // Everything outside the draft still moves with the provider.
    expect(refresh.season.league.name).toBe("Sleeper Friends League");
    expect(refresh.season.settings.scoring?.reception).toBe(1);
  });

  it("refuses to add or drop a team behind the owner's back", () => {
    const season = seasonFixture("draft");
    const input = importedInput(managersOf(season).slice(0, 3));

    const refresh = refreshedSeasonFromImport(season, { ...input, expectedTeamCount: 3 });

    expect(refresh).toEqual({
      status: "blocked",
      detail: "This league now has 3 teams at the provider and 4 in Sunday Games. " +
        "Fix the teams in the league settings, then sync again.",
    });
  });
});
