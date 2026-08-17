import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import { applyLeagueSetupImportToSeason } from "../src/platform/leagueSetupImport.js";

describe("platform league setup import mappings", () => {
  it("uses an ordinal fallback when an applied record has no slug characters", () => {
    const season = buildCurrentMockdLeagueSeason([], {
      ...leagueConfig,
      teams: 0,
    }, { leagueName: "Auction Crew", seasonYear: 2027, setupStatus: "published" });

    const applied = applyLeagueSetupImportToSeason(season, [{
      sourceRowNumber: 1,
      ownerDisplayName: "---",
      teamDisplayName: "Unmapped Team",
      role: "observer",
    }]);

    expect(applied.season.teams).toContainEqual(expect.objectContaining({
      id: `${season.id}-team-01-team-1`,
      ownerId: "owner-team-1",
      draftOrderPosition: 1,
    }));
  });

  it("applies explicit, inferred, and new team mappings in one exact result", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 2), {
      ...leagueConfig,
      teams: 2,
    }, { leagueName: "Auction Crew", seasonYear: 2027, setupStatus: "published" });
    const firstTeam = season.teams.at(0);
    const secondTeam = season.teams.at(1);
    if (firstTeam === undefined || secondTeam === undefined) {
      throw new Error("Expected two mapped team fixtures.");
    }

    const applied = applyLeagueSetupImportToSeason(season, [
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Renamed Owner",
        managerDisplayNames: ["Primary Manager", "Co-manager"],
        abbreviation: "REN",
        draftOrderPosition: 8,
        existingTeamId: secondTeam.id,
        teamDisplayName: "Explicit Match",
        email: "renamed@example.com",
        role: "admin",
      },
      {
        sourceRowNumber: 3,
        ownerDisplayName: firstTeam.ownerDisplayName,
        teamDisplayName: "Owner Match",
        role: "member",
      },
      {
        sourceRowNumber: 4,
        ownerDisplayName: "Expansion Owner",
        teamDisplayName: "Expansion Team",
        role: "observer",
      },
    ]);

    expect(applied).toEqual({
      season: {
        ...season,
        teams: [
          {
            id: secondTeam.id,
            leagueSeasonId: season.id,
            ownerId: secondTeam.ownerId,
            ownerDisplayName: "Renamed Owner",
            managerDisplayNames: ["Primary Manager", "Co-manager"],
            abbreviation: "REN",
            displayName: "Explicit Match",
            draftOrderPosition: 8,
          },
          {
            id: firstTeam.id,
            leagueSeasonId: season.id,
            ownerId: firstTeam.ownerId,
            ownerDisplayName: firstTeam.ownerDisplayName,
            displayName: "Owner Match",
            draftOrderPosition: secondTeam.draftOrderPosition,
          },
          {
            id: `${season.id}-team-03-expansion-owner`,
            leagueSeasonId: season.id,
            ownerId: "owner-expansion-owner",
            ownerDisplayName: "Expansion Owner",
            displayName: "Expansion Team",
            draftOrderPosition: 3,
          },
        ],
      },
      memberships: [
        {
          leagueId: season.leagueId,
          ownerId: secondTeam.ownerId,
          teamId: secondTeam.id,
          ownerDisplayName: "Renamed Owner",
          teamDisplayName: "Explicit Match",
          email: "renamed@example.com",
          role: "admin",
        },
        {
          leagueId: season.leagueId,
          ownerId: firstTeam.ownerId,
          teamId: firstTeam.id,
          ownerDisplayName: firstTeam.ownerDisplayName,
          teamDisplayName: "Owner Match",
          role: "member",
        },
        {
          leagueId: season.leagueId,
          ownerId: "owner-expansion-owner",
          teamId: `${season.id}-team-03-expansion-owner`,
          ownerDisplayName: "Expansion Owner",
          teamDisplayName: "Expansion Team",
          role: "observer",
        },
      ],
    });
  });

  it("keeps every team when a row is renamed and reordered in the same save", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 3), {
      ...leagueConfig,
      teams: 3,
    }, { leagueName: "Auction Crew", seasonYear: 2027, setupStatus: "published" });
    const [first, second, third] = season.teams;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error("Expected three mapped team fixtures.");
    }

    const applied = applyLeagueSetupImportToSeason(season, [
      {
        sourceRowNumber: 2,
        ownerDisplayName: second.ownerDisplayName,
        teamDisplayName: second.displayName,
        existingTeamId: second.id,
        role: "member",
      },
      {
        sourceRowNumber: 3,
        ownerDisplayName: `${first.ownerDisplayName}e`,
        teamDisplayName: first.displayName,
        existingTeamId: first.id,
        role: "member",
      },
      {
        sourceRowNumber: 4,
        ownerDisplayName: third.ownerDisplayName,
        teamDisplayName: third.displayName,
        existingTeamId: third.id,
        role: "member",
      },
    ]);

    expect(applied.season.teams.map(team => team.id)).toEqual([second.id, first.id, third.id]);
    expect(applied.season.teams.at(1)).toMatchObject({
      id: first.id,
      ownerId: first.ownerId,
      ownerDisplayName: `${first.ownerDisplayName}e`,
    });
  });
});
