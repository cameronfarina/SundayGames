import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import { unclaimedTeamsForRecords } from "../src/platform/leagueSetupImport.js";
import type { LeagueSetupTeamRecord } from "../src/platform/leagueSetupImport.js";

const seasonWith = (teamCount: number) => buildCurrentMockdLeagueSeason(
  ownerOrder.slice(0, teamCount),
  { ...leagueConfig, teams: teamCount },
  { leagueName: "Crew", seasonYear: 2027, setupStatus: "published" },
);

const row = (
  sourceRowNumber: number,
  ownerDisplayName: string,
  teamDisplayName: string,
  existingTeamId?: string,
): LeagueSetupTeamRecord => ({
  sourceRowNumber,
  ownerDisplayName,
  teamDisplayName,
  ...(existingTeamId === undefined ? {} : { existingTeamId }),
  role: "member",
});

describe("teams a submitted list would leave behind", () => {
  it("leaves nothing behind when every row carries its team id", () => {
    const season = seasonWith(3);
    const [first, second, third] = season.teams;
    if (!first || !second || !third) throw new Error("Expected three teams.");

    expect(unclaimedTeamsForRecords(season, [
      row(2, second.ownerDisplayName, second.displayName, second.id),
      row(3, `${first.ownerDisplayName}e`, first.displayName, first.id),
      row(4, third.ownerDisplayName, third.displayName, third.id),
    ])).toEqual([]);
  });

  it("reports the team a renamed and reordered paste would delete", () => {
    const season = seasonWith(3);
    const [first, second, third] = season.teams;
    if (!first || !second || !third) throw new Error("Expected three teams.");

    // Pasted rows carry no ids. Row 1 matches the second team by name, so the
    // renamed first manager falls back to a slot that is already taken.
    expect(unclaimedTeamsForRecords(season, [
      row(2, second.ownerDisplayName, second.displayName),
      row(3, `${first.ownerDisplayName}e`, first.displayName),
      row(4, third.ownerDisplayName, third.displayName),
    ])).toEqual([first]);
  });

  it("reports every team a shorter list would drop", () => {
    const season = seasonWith(3);
    const [first, second, third] = season.teams;
    if (!first || !second || !third) throw new Error("Expected three teams.");

    expect(unclaimedTeamsForRecords(season, [
      row(2, first.ownerDisplayName, first.displayName, first.id),
    ])).toEqual([second, third]);
  });

  it("leaves nothing behind when a plain rename keeps its slot", () => {
    const season = seasonWith(3);
    const [first, second, third] = season.teams;
    if (!first || !second || !third) throw new Error("Expected three teams.");

    expect(unclaimedTeamsForRecords(season, [
      row(2, `${first.ownerDisplayName}e`, first.displayName),
      row(3, second.ownerDisplayName, second.displayName),
      row(4, third.ownerDisplayName, third.displayName),
    ])).toEqual([]);
  });

  it("leaves nothing behind for a season that holds no teams yet", () => {
    const season = buildCurrentMockdLeagueSeason([], { ...leagueConfig, teams: 0 }, {
      leagueName: "Crew", seasonYear: 2027, setupStatus: "draft",
    });

    expect(unclaimedTeamsForRecords(season, [row(1, "Newcomer", "New Team")])).toEqual([]);
  });
});
