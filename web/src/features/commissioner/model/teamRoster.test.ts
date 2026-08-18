import { describe, expect, it } from "vitest";
import { auctionSeason } from "../test/commissionerFixtures";
import {
  teamRosterContent,
  teamRosterRows,
  withRowEdited,
  type TeamRosterRow,
} from "./teamRoster";

const rows: TeamRosterRow[] = [
  { teamId: "team-1", ownerDisplayName: "Ty", teamDisplayName: "Short King", savedOwnerDisplayName: "Ty" },
  { teamId: "team-2", ownerDisplayName: "Bob", teamDisplayName: "Bob's Team", savedOwnerDisplayName: "Bob" },
];

describe("teamRoster", () => {
  it("reads each team into a row that remembers its team id", () => {
    expect(teamRosterRows(auctionSeason)).toEqual([{
      teamId: "team-1",
      ownerDisplayName: "Owner11",
      teamDisplayName: "Short King",
      savedOwnerDisplayName: "Owner11",
    }]);
  });

  it("sends the team id beside every row so a rename edits that team", () => {
    expect(teamRosterContent(rows)).toBe([
      "teamId,owner,team,role",
      "team-1,Ty,Short King,member",
      "team-2,Bob,Bob's Team,member",
    ].join("\n"));
  });

  it("quotes names holding a comma or a quote so they survive the round trip", () => {
    expect(teamRosterContent([
      {
        teamId: "team-1",
        ownerDisplayName: "Ty, Jr.",
        teamDisplayName: "The \"Best\" Team",
        savedOwnerDisplayName: "Ty, Jr.",
      },
    ])).toBe([
      "teamId,owner,team,role",
      "team-1,\"Ty, Jr.\",\"The \"\"Best\"\" Team\",member",
    ].join("\n"));
  });

  it("edits one row, keeping its team id and the name already saved", () => {
    expect(withRowEdited(rows, 0, { ownerDisplayName: "Tye" })).toEqual([
      {
        teamId: "team-1",
        ownerDisplayName: "Tye",
        teamDisplayName: "Short King",
        savedOwnerDisplayName: "Ty",
      },
      rows[1],
    ]);
  });


});
