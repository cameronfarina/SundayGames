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
      "Cam, Cam's Team",
      "Seth | ",
      "\"Sam, Jr.\", Sam's Squad",
    ].join("\n"));

    expect(result.status).toBe("ready");
    expect(result.blockers).toEqual([]);
    expect(result.records).toEqual([
      {
        sourceRowNumber: 1,
        ownerDisplayName: "Cam",
        teamDisplayName: "Cam's Team",
        role: "member",
      },
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Seth",
        teamDisplayName: "Seth",
        role: "member",
      },
      {
        sourceRowNumber: 3,
        ownerDisplayName: "Sam, Jr.",
        teamDisplayName: "Sam's Squad",
        role: "member",
      },
    ]);
  });

  it("parses CSV headers with email and role columns", () => {
    const result = parseLeagueSetupImport([
      "owner,team,email,role",
      "Cam,Cam's Team,cam@example.com,owner",
      "Alex,,alex@example.com,observer",
    ].join("\n"), {
      expectedTeamCount: 2,
    });

    expect(result.status).toBe("ready");
    expect(result.records).toEqual([
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Cam",
        teamDisplayName: "Cam's Team",
        email: "cam@example.com",
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
      "Cam,Cam's Team,cam@example.com,owner",
      " cam ,Another Team,cam-alt@example.com,member",
      "Seth,Cam's Team,seth@example.com,coach",
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
      "Cam,Cam's Team,cam@example.com,owner",
      "\"Seth,Seth's Team,seth@example.com,member",
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
      "Cam,Cam's Team,cam@example.com,owner",
      "Seth,Seth's Champs,seth@example.com,member",
      "Beaton,,beaton@example.com,admin",
    ].join("\n"), {
      expectedTeamCount: 3,
    });

    const applied = applyLeagueSetupImportToSeason(customDraftOrderSeason, parsed.records);

    expect(applied.season).not.toBe(customDraftOrderSeason);
    expect(applied.season.settings).toEqual(customDraftOrderSeason.settings);
    expect(applied.season.settings).not.toBe(customDraftOrderSeason.settings);
    expect(applied.season.draft).toEqual(customDraftOrderSeason.draft);
    expect(applied.season.teams.map(team => team.draftOrderPosition)).toEqual([3, 1, 2]);
    expect(applied.season.teams.map(team => ({
      ownerDisplayName: team.ownerDisplayName,
      displayName: team.displayName,
    }))).toEqual([
      { ownerDisplayName: "Cam", displayName: "Cam's Team" },
      { ownerDisplayName: "Seth", displayName: "Seth's Champs" },
      { ownerDisplayName: "Beaton", displayName: "Beaton" },
    ]);
    expect(applied.memberships).toEqual([
      {
        leagueId: customDraftOrderSeason.leagueId,
        ownerId: applied.season.teams[0]!.ownerId,
        teamId: applied.season.teams[0]!.id,
        ownerDisplayName: "Cam",
        teamDisplayName: "Cam's Team",
        email: "cam@example.com",
        role: "owner",
      },
      {
        leagueId: customDraftOrderSeason.leagueId,
        ownerId: applied.season.teams[1]!.ownerId,
        teamId: applied.season.teams[1]!.id,
        ownerDisplayName: "Seth",
        teamDisplayName: "Seth's Champs",
        email: "seth@example.com",
        role: "member",
      },
      {
        leagueId: customDraftOrderSeason.leagueId,
        ownerId: applied.season.teams[2]!.ownerId,
        teamId: applied.season.teams[2]!.id,
        ownerDisplayName: "Beaton",
        teamDisplayName: "Beaton",
        email: "beaton@example.com",
        role: "admin",
      },
    ]);
  });
});
