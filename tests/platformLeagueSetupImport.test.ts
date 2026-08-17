import { describe, expect, it } from "vitest";
import { parseLeagueSetupImport } from "../src/platform/leagueSetupImport.js";

describe("platform league setup import parsing", () => {
  it("returns an empty ready preview for empty content", () => {
    expect(parseLeagueSetupImport("")).toEqual({
      status: "ready",
      blockers: [],
      rows: [],
      records: [],
    });
  });

  it("ignores duplicate and blank header cells while preserving positional team data", () => {
    const result = parseLeagueSetupImport([
      "owner,owner,,role",
      "Owner11,Owner11's Team,,admin",
    ].join("\n"));

    expect(result.records).toEqual([{
      sourceRowNumber: 2,
      ownerDisplayName: "Owner11",
      teamDisplayName: "Owner11's Team",
      role: "admin",
    }]);
  });

  it("ignores blank rows and preserves escaped quotes and quoted pipe characters", () => {
    const result = parseLeagueSetupImport([
      "",
      "\"Owner \"\"Ace|Pilot\"\"\",\"Team \"\"Alpha\"\"\"",
      " ",
    ].join("\n"));

    expect(result).toMatchObject({
      status: "ready",
      blockers: [],
      records: [{
        sourceRowNumber: 2,
        ownerDisplayName: "Owner \"Ace|Pilot\"",
        teamDisplayName: "Team \"Alpha\"",
        role: "member",
      }],
    });
  });

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

  it("carries a team id column through as the record's existing team", () => {
    const result = parseLeagueSetupImport([
      "teamId,owner,team,role",
      "season-2027-team-01-ty,Tye,Tye's Team,member",
      "season-2027-team-02-bob,Bob,Bob's Team,member",
    ].join("\n"), {
      expectedTeamCount: 2,
    });

    expect(result.status).toBe("ready");
    expect(result.records).toEqual([
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Tye",
        teamDisplayName: "Tye's Team",
        existingTeamId: "season-2027-team-01-ty",
        role: "member",
      },
      {
        sourceRowNumber: 3,
        ownerDisplayName: "Bob",
        teamDisplayName: "Bob's Team",
        existingTeamId: "season-2027-team-02-bob",
        role: "member",
      },
    ]);
  });

  it("never reads an existing team id from headerless positional rows", () => {
    const result = parseLeagueSetupImport("Owner11,Owner11's Team");

    expect(result.records).toEqual([{
      sourceRowNumber: 1,
      ownerDisplayName: "Owner11",
      teamDisplayName: "Owner11's Team",
      role: "member",
    }]);
  });

  it("keeps a header that names no email column from mailing the cell beside it", () => {
    const result = parseLeagueSetupImport([
      "owner,team,role",
      "Owner11,Owner11's Team,admin",
    ].join("\n"));

    expect(result.records).toEqual([{
      sourceRowNumber: 2,
      ownerDisplayName: "Owner11",
      teamDisplayName: "Owner11's Team",
      role: "admin",
    }]);
  });

  it("ignores a blank team id cell rather than claiming a team with no id", () => {
    const result = parseLeagueSetupImport([
      "teamId,owner,team,role",
      ",Newcomer,Newcomer's Team,member",
    ].join("\n"));

    expect(result.records).toEqual([{
      sourceRowNumber: 2,
      ownerDisplayName: "Newcomer",
      teamDisplayName: "Newcomer's Team",
      role: "member",
    }]);
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
      { rowNumber: 2, status: "blocked", blockerCodes: ["duplicate_owner_name", "duplicate_team_name"] },
      { rowNumber: 3, status: "blocked", blockerCodes: ["duplicate_owner_name"] },
      { rowNumber: 4, status: "blocked", blockerCodes: ["duplicate_team_name", "invalid_role"] },
      { rowNumber: 5, status: "blocked", blockerCodes: ["blank_owner"] },
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
      blockers: [{
        code: "malformed_row",
        severity: "blocker",
        message: "Row 3 has an unterminated quoted field.",
        rowNumber: 3,
      }],
      record: null,
    });
    expect(result.records).toEqual([]);
  });

  it("returns the exact blocked preview when only part of an import is valid", () => {
    const result = parseLeagueSetupImport([
      "manager name,team name,invite email,membership role",
      "Owner11,Owner11's Team,OWNER11@EXAMPLE.COM,admin",
      "Owner04,Owner04's Team,owner04@example.com,coach",
      "\"Owner12,Owner12's Team,owner12@example.com,member",
    ].join("\n"), {
      expectedTeamCount: 4,
    });

    expect(result).toEqual({
      status: "blocked",
      blockers: [
        {
          code: "expected_team_count_mismatch",
          severity: "blocker",
          message: "Expected 4 teams, but found 3.",
        },
        {
          code: "malformed_row",
          severity: "blocker",
          message: "Row 4 has an unterminated quoted field.",
          rowNumber: 4,
        },
        {
          code: "invalid_role",
          severity: "blocker",
          message: "Invalid league setup role \"coach\". Use owner, admin, member, or observer.",
          rowNumber: 3,
        },
      ],
      rows: [
        {
          rowNumber: 2,
          status: "ready",
          blockers: [],
          record: {
            sourceRowNumber: 2,
            ownerDisplayName: "Owner11",
            teamDisplayName: "Owner11's Team",
            email: "owner11@example.com",
            role: "admin",
          },
        },
        {
          rowNumber: 3,
          status: "blocked",
          blockers: [{
            code: "invalid_role",
            severity: "blocker",
            message: "Invalid league setup role \"coach\". Use owner, admin, member, or observer.",
            rowNumber: 3,
          }],
          record: null,
        },
        {
          rowNumber: 4,
          status: "blocked",
          blockers: [{
            code: "malformed_row",
            severity: "blocker",
            message: "Row 4 has an unterminated quoted field.",
            rowNumber: 4,
          }],
          record: null,
        },
      ],
      records: [],
    });
  });
});
