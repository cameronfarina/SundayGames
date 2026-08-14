import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  applyLeagueSetupImportToSeason,
  parseLeagueSetupImport,
} from "../src/platform/leagueSetupImport.js";

describe("platform league setup imports", () => {
  it("parses comma, pipe, and quoted rows into normalized team setup records", () => {
    const result = parseLeagueSetupImport([
      "Owner11, Owner11's Team",
      "Owner04 | ",
      "\"Owner12, Jr.\", Owner12's Squad",
    ].join("\n"));

    expect(result.status).toBe("ready");
    expect(result.blockers).toEqual([]);
    expect(result.records).toEqual([
      {
        sourceRowNumber: 1,
        ownerDisplayName: "Owner11",
        teamDisplayName: "Owner11's Team",
        role: "member",
      },
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Owner04",
        teamDisplayName: "Owner04",
        role: "member",
      },
      {
        sourceRowNumber: 3,
        ownerDisplayName: "Owner12, Jr.",
        teamDisplayName: "Owner12's Squad",
        role: "member",
      },
    ]);
  });

  it("parses CSV headers with email and role columns", () => {
    const result = parseLeagueSetupImport([
      "owner,team,email,role",
      "Owner11,Owner11's Team,owner11@example.com,owner",
      "Alex,,alex@example.com,observer",
    ].join("\n"), {
      expectedTeamCount: 2,
    });

    expect(result.status).toBe("ready");
    expect(result.records).toEqual([
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Owner11",
        teamDisplayName: "Owner11's Team",
        email: "owner11@example.com",
        role: "owner",
      },
      {
        sourceRowNumber: 3,
        ownerDisplayName: "Alex",
        teamDisplayName: "Alex",
        email: "alex@example.com",
        role: "observer",
      },
    ]);
  });

  it("blocks expected count mismatches, blank owners, duplicates, and invalid roles", () => {
    const result = parseLeagueSetupImport([
      "owner,team,email,role",
      "Owner11,Owner11's Team,owner11@example.com,owner",
      " owner11 ,Another Team,owner11-alt@example.com,member",
      "Owner04,Owner11's Team,owner04@example.com,coach",
      ",No Owner,no-owner@example.com,member",
    ].join("\n"), {
      expectedTeamCount: 5,
    });

    expect(result.status).toBe("blocked");
    expect(result.blockers.map(blocker => blocker.code)).toEqual([
      "expected_team_count_mismatch",
      "duplicate_owner_name",
      "duplicate_owner_name",
      "duplicate_team_name",
      "duplicate_team_name",
      "invalid_role",
      "blank_owner",
    ]);
    expect(result.rows.map(row => ({
      rowNumber: row.rowNumber,
      status: row.status,
      blockerCodes: row.blockers.map(blocker => blocker.code),
    }))).toEqual([
      {
        rowNumber: 2,
        status: "blocked",
        blockerCodes: ["duplicate_owner_name", "duplicate_team_name"],
      },
      {
        rowNumber: 3,
        status: "blocked",
        blockerCodes: ["duplicate_owner_name"],
      },
      {
        rowNumber: 4,
        status: "blocked",
        blockerCodes: ["duplicate_team_name", "invalid_role"],
      },
      {
        rowNumber: 5,
        status: "blocked",
        blockerCodes: ["blank_owner"],
      },
    ]);
    expect(result.records).toEqual([]);
  });

  it("returns row-level blockers for malformed pasted setup rows", () => {
    const result = parseLeagueSetupImport([
      "owner,team,email,role",
      "Owner11,Owner11's Team,owner11@example.com,owner",
      "\"Owner04,Owner04's Team,owner04@example.com,member",
    ].join("\n"), {
      expectedTeamCount: 2,
    });

    expect(result.status).toBe("blocked");
    expect(result.blockers.map(blocker => blocker.code)).toContain("malformed_row");
    expect(result.rows).toContainEqual({
      rowNumber: 3,
      status: "blocked",
      blockers: [
        {
          code: "malformed_row",
          severity: "blocker",
          message: "Row 3 has an unterminated quoted field.",
          rowNumber: 3,
        },
      ],
      record: null,
    });
    expect(result.records).toEqual([]);
  });

  it("applies parsed setup records to a LeagueSeason copy while preserving settings and draft order", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 3), {
      ...leagueConfig,
      teams: 3,
    }, {
      leagueName: "Auction Crew",
      seasonYear: 2027,
      setupStatus: "published",
      draft: { scheduledAt: "2027-08-23T23:00:00.000Z", timezone: "America/New_York" },
    });
    const customDraftOrderSeason = {
      ...season,
      teams: [
        { ...season.teams[0]!, draftOrderPosition: 3 },
        { ...season.teams[1]!, draftOrderPosition: 1 },
        { ...season.teams[2]!, draftOrderPosition: 2 },
      ],
    };
    const parsed = parseLeagueSetupImport([
      "owner,team,email,role",
      "Owner11,Owner11's Team,owner11@example.com,owner",
      "Owner04,Owner04's Champs,owner04@example.com,member",
      "Owner01,,owner01@example.com,admin",
    ].join("\n"), {
      expectedTeamCount: 3,
    });

    const applied = applyLeagueSetupImportToSeason(customDraftOrderSeason, parsed.records);

    expect(applied.season).not.toBe(customDraftOrderSeason);
    expect(applied.season.settings).toEqual(customDraftOrderSeason.settings);
    expect(applied.season.settings).not.toBe(customDraftOrderSeason.settings);
    expect(applied.season.draft).toEqual(customDraftOrderSeason.draft);
    expect(applied.season.teams.map(team => team.id)).toEqual([
      `${season.id}-team-01-owner11`,
      `${season.id}-team-02-owner04`,
      customDraftOrderSeason.teams[0]!.id,
    ]);
    expect(applied.season.teams.map(team => team.ownerId)).toEqual([
      "owner-owner11",
      "owner-owner04",
      customDraftOrderSeason.teams[0]!.ownerId,
    ]);
    expect(applied.season.teams.map(team => team.draftOrderPosition)).toEqual([3, 1, 2]);
    expect(applied.season.teams.map(team => ({
      ownerDisplayName: team.ownerDisplayName,
      displayName: team.displayName,
    }))).toEqual([
      { ownerDisplayName: "Owner11", displayName: "Owner11's Team" },
      { ownerDisplayName: "Owner04", displayName: "Owner04's Champs" },
      { ownerDisplayName: "Owner01", displayName: "Owner01" },
    ]);
    expect(applied.memberships).toEqual([
      {
        leagueId: customDraftOrderSeason.leagueId,
        ownerId: applied.season.teams[0]!.ownerId,
        teamId: applied.season.teams[0]!.id,
        ownerDisplayName: "Owner11",
        teamDisplayName: "Owner11's Team",
        email: "owner11@example.com",
        role: "owner",
      },
      {
        leagueId: customDraftOrderSeason.leagueId,
        ownerId: applied.season.teams[1]!.ownerId,
        teamId: applied.season.teams[1]!.id,
        ownerDisplayName: "Owner04",
        teamDisplayName: "Owner04's Champs",
        email: "owner04@example.com",
        role: "member",
      },
      {
        leagueId: customDraftOrderSeason.leagueId,
        ownerId: applied.season.teams[2]!.ownerId,
        teamId: applied.season.teams[2]!.id,
        ownerDisplayName: "Owner01",
        teamDisplayName: "Owner01",
        email: "owner01@example.com",
        role: "admin",
      },
    ]);
  });

  it("preserves existing team and profile identities when legacy owner rows are reordered", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 3), {
      ...leagueConfig,
      teams: 3,
    }, {
      leagueName: "Auction Crew",
      seasonYear: 2027,
      setupStatus: "published",
    });
    const existingByOwner = new Map(season.teams.map(team => [team.ownerDisplayName, team]));
    const parsed = parseLeagueSetupImport([
      "owner,team,email,role",
      "Owner02,Owner02's Champs,owner02@example.com,member",
      "Owner03,Owner03 Ballers,owner03@example.com,admin",
      "Owner01,Owner01's Team,owner01@example.com,owner",
    ].join("\n"), {
      expectedTeamCount: 3,
    });

    const applied = applyLeagueSetupImportToSeason(season, parsed.records);

    expect(applied.season.teams.map(team => ({
      ownerDisplayName: team.ownerDisplayName,
      id: team.id,
      ownerId: team.ownerId,
    }))).toEqual(["Owner02", "Owner03", "Owner01"].map(ownerDisplayName => {
      const existing = existingByOwner.get(ownerDisplayName);
      if (existing === undefined) throw new Error(`Missing ${ownerDisplayName} team fixture.`);

      return {
        ownerDisplayName,
        id: existing.id,
        ownerId: existing.ownerId,
      };
    }));
    expect(applied.season.teams.map(team => team.draftOrderPosition)).toEqual(
      season.teams.map(team => team.draftOrderPosition),
    );
    expect(applied.memberships.map(membership => ({
      ownerDisplayName: membership.ownerDisplayName,
      teamId: membership.teamId,
      ownerId: membership.ownerId,
    }))).toEqual(["Owner02", "Owner03", "Owner01"].map(ownerDisplayName => {
      const existing = existingByOwner.get(ownerDisplayName);
      if (existing === undefined) throw new Error(`Missing ${ownerDisplayName} team fixture.`);

      return {
        ownerDisplayName,
        teamId: existing.id,
        ownerId: existing.ownerId,
      };
    }));
  });

  it("creates a new team and profile identity for a genuinely new legacy owner row", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 2), {
      ...leagueConfig,
      teams: 2,
    }, {
      leagueName: "Auction Crew",
      seasonYear: 2027,
      setupStatus: "published",
    });
    const parsed = parseLeagueSetupImport([
      "owner,team,email,role",
      "Owner02,Owner02's Champs,owner02@example.com,member",
      "Alex,Expansion Team,alex@example.com,member",
    ].join("\n"), {
      expectedTeamCount: 2,
    });

    const applied = applyLeagueSetupImportToSeason(season, parsed.records);
    const existingHoodyTeam = season.teams.find(team => team.ownerDisplayName === "Owner02");
    const newAlexTeam = applied.season.teams.find(team => team.ownerDisplayName === "Alex");
    if (existingHoodyTeam === undefined || newAlexTeam === undefined) {
      throw new Error("Expected Owner02 and Alex team fixtures.");
    }

    expect(newAlexTeam).toMatchObject({
      id: `${season.id}-team-02-alex`,
      ownerId: "owner-alex",
      draftOrderPosition: 2,
    });
    expect(season.teams.map(team => team.id)).not.toContain(newAlexTeam.id);
    expect(applied.memberships).toContainEqual(expect.objectContaining({
      ownerDisplayName: "Owner02",
      teamId: existingHoodyTeam.id,
      ownerId: existingHoodyTeam.ownerId,
    }));
    expect(applied.memberships).toContainEqual(expect.objectContaining({
      ownerDisplayName: "Alex",
      teamId: newAlexTeam.id,
      ownerId: newAlexTeam.ownerId,
    }));
  });
});
