import { describe, expect, it } from "vitest";
import { leagueConfig } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  applyLeagueMembersScreenshotImportToSeason,
  suggestLeagueMembersScreenshotTeamMappings,
  validateLeagueMembersScreenshotImport,
} from "../src/platform/leagueMembersScreenshotImport.js";

const validImport = {
  leagueName: "The Sunday Games",
  externalLeagueId: "100001",
  teams: [
    {
      draftOrderPosition: 1,
      abbreviation: "OWN04",
      teamDisplayName: "Washington Sentinels",
      managerDisplayNames: ["Owner04 Fortier"],
      confidence: "high" as const,
      issues: [],
      confirmed: false,
    },
    {
      draftOrderPosition: 2,
      abbreviation: "PB",
      teamDisplayName: "Peace Bridge",
      managerDisplayNames: ["Nick Coutinho", "Tyler Borosavage"],
      confidence: "high" as const,
      issues: [],
      confirmed: false,
    },
  ],
};

describe("league members screenshot imports", () => {
  it("validates ordered teams without collecting email or status fields", () => {
    const result = validateLeagueMembersScreenshotImport(validImport, { expectedTeamCount: 2 });

    expect(result.status).toBe("ready");
    expect(result.blockers).toEqual([]);
    expect(result.records).toEqual([
      {
        sourceRowNumber: 1,
        draftOrderPosition: 1,
        abbreviation: "OWN04",
        ownerDisplayName: "Owner04 Fortier",
        managerDisplayNames: ["Owner04 Fortier"],
        teamDisplayName: "Washington Sentinels",
        role: "member",
      },
      {
        sourceRowNumber: 2,
        draftOrderPosition: 2,
        abbreviation: "PB",
        ownerDisplayName: "Nick Coutinho",
        managerDisplayNames: ["Nick Coutinho", "Tyler Borosavage"],
        teamDisplayName: "Peace Bridge",
        role: "member",
      },
    ]);
    expect(Object.keys(result.records[0] ?? {})).not.toContain("email");
    expect(Object.keys(result.records[0] ?? {})).not.toContain("membershipStatus");
  });

  it("blocks truncated, uncertain, incomplete, duplicate, and out-of-order rows", () => {
    const result = validateLeagueMembersScreenshotImport({
      leagueName: "The Sunday Games",
      externalLeagueId: null,
      teams: [
        {
          draftOrderPosition: 2,
          abbreviation: "PB",
          teamDisplayName: "Peace Bridge",
          managerDisplayNames: ["Same Manager"],
          confidence: "medium",
          issues: ["Manager name is hard to read."],
          confirmed: false,
        },
        {
          draftOrderPosition: 2,
          abbreviation: "",
          teamDisplayName: "Were off The weee...",
          managerDisplayNames: ["Same Manager"],
          confidence: "high",
          issues: [],
          confirmed: false,
        },
      ],
    }, { expectedTeamCount: 3 });

    expect(result.status).toBe("blocked");
    expect(result.blockers.map(blocker => blocker.code)).toEqual(expect.arrayContaining([
      "expected_team_count_mismatch",
      "duplicate_draft_order_position",
      "missing_abbreviation",
      "truncated_team_name",
      "duplicate_manager_name",
      "review_required",
    ]));
    expect(result.records).toEqual([]);
  });

  it("requires team numbers to cover the complete one-based season range", () => {
    const result = validateLeagueMembersScreenshotImport({
      ...validImport,
      teams: validImport.teams.map((team, index) => ({
        ...team,
        draftOrderPosition: index + 2,
      })),
    }, { expectedTeamCount: 2 });

    expect(result.status).toBe("blocked");
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_draft_order_position", rowNumber: 2 }),
    ]));
  });

  it("suggests only unambiguous existing profiles and requires a unique profile for every row", () => {
    const season = buildCurrentMockdLeagueSeason(["Owner04", "Owner11"], {
      ...leagueConfig,
      teams: 2,
    });
    const suggested = suggestLeagueMembersScreenshotTeamMappings({
      ...validImport,
      teams: [
        validImport.teams[0]!,
        { ...validImport.teams[1]!, managerDisplayNames: ["Example Manager"] },
      ],
    }, season);

    expect(suggested.teams[0]?.targetTeamId).toBe(season.teams[0]?.id);
    expect(suggested.teams[1]?.targetTeamId).toBeNull();

    const result = validateLeagueMembersScreenshotImport(suggested, {
      expectedTeamCount: 2,
      existingTeams: season.teams,
      requireTeamMappings: true,
    });
    expect(result.status).toBe("blocked");
    expect(result.blockers).toContainEqual(expect.objectContaining({
      code: "missing_team_mapping",
      rowNumber: 2,
    }));
  });

  it("allows a commissioner to confirm model uncertainty after correcting visible fields", () => {
    const result = validateLeagueMembersScreenshotImport({
      ...validImport,
      teams: validImport.teams.map((team, index) => index === 0
        ? { ...team, confidence: "medium" as const, issues: ["Verify this row."], confirmed: true }
        : team),
    }, { expectedTeamCount: 2 });

    expect(result.status).toBe("ready");
  });

  it("applies league metadata, abbreviations, and co-manager identities without changing settings", () => {
    const season = buildCurrentMockdLeagueSeason(["Old One", "Old Two"], {
      ...leagueConfig,
      teams: 2,
    }, { leagueName: "Old League" });
    const validated = validateLeagueMembersScreenshotImport(validImport, { expectedTeamCount: 2 });

    const applied = applyLeagueMembersScreenshotImportToSeason(season, validated);

    expect(applied.season.league).toMatchObject({
      id: season.league.id,
      name: "The Sunday Games",
      provider: "espn",
      externalLeagueId: "100001",
    });
    expect(applied.season.settings).toEqual(season.settings);
    expect(applied.season.teams.map(team => team.id)).toEqual(season.teams.map(team => team.id));
    expect(applied.season.teams.map(team => team.ownerId)).toEqual(season.teams.map(team => team.ownerId));
    expect(applied.season.teams).toEqual([
      expect.objectContaining({
        abbreviation: "OWN04",
        draftOrderPosition: 1,
        ownerDisplayName: "Owner04 Fortier",
        managerDisplayNames: ["Owner04 Fortier"],
        displayName: "Washington Sentinels",
      }),
      expect.objectContaining({
        abbreviation: "PB",
        draftOrderPosition: 2,
        ownerDisplayName: "Nick Coutinho",
        managerDisplayNames: ["Nick Coutinho", "Tyler Borosavage"],
        displayName: "Peace Bridge",
      }),
    ]);
  });

  it("updates the explicitly mapped profiles instead of transferring identity by imported row number", () => {
    const season = buildCurrentMockdLeagueSeason(["Old One", "Old Two"], {
      ...leagueConfig,
      teams: 2,
    });
    const validated = validateLeagueMembersScreenshotImport({
      ...validImport,
      teams: [
        { ...validImport.teams[0]!, targetTeamId: season.teams[1]!.id },
        { ...validImport.teams[1]!, targetTeamId: season.teams[0]!.id },
      ],
    }, {
      expectedTeamCount: 2,
      existingTeams: season.teams,
      requireTeamMappings: true,
    });

    const applied = applyLeagueMembersScreenshotImportToSeason(season, validated);

    expect(applied.season.teams.map(team => ({
      id: team.id,
      ownerId: team.ownerId,
      manager: team.ownerDisplayName,
    }))).toEqual([
      {
        id: season.teams[1]!.id,
        ownerId: season.teams[1]!.ownerId,
        manager: "Owner04 Fortier",
      },
      {
        id: season.teams[0]!.id,
        ownerId: season.teams[0]!.ownerId,
        manager: "Nick Coutinho",
      },
    ]);
  });
});
