import { describe, expect, it } from "vitest";
import { auctionSeason } from "../test/commissionerFixtures";
import {
  teamRosterContent,
  teamRosterRows,
  withDraftOrderCommitted,
  withRowEdited,
  type TeamRosterRow,
} from "./teamRoster";

const rows: TeamRosterRow[] = [
  { teamId: "team-1", ownerDisplayName: "Ty", teamDisplayName: "Short King", draftOrder: "1", savedOwnerDisplayName: "Ty" },
  { teamId: "team-2", ownerDisplayName: "Bob", teamDisplayName: "Bob's Team", draftOrder: "2", savedOwnerDisplayName: "Bob" },
];

describe("teamRoster", () => {
  it("reads each team into a row that remembers its team id", () => {
    expect(teamRosterRows(auctionSeason)).toEqual([{
      teamId: "team-1",
      ownerDisplayName: "Owner11",
      teamDisplayName: "Short King",
      draftOrder: "1",
      savedOwnerDisplayName: "Owner11",
    }]);
  });

  it("sends the team id beside every row so a rename edits that team", () => {
    expect(teamRosterContent(rows)).toBe([
      "teamId,owner,team,role,draftOrder",
      "team-1,Ty,Short King,member,1",
      "team-2,Bob,Bob's Team,member,2",
    ].join("\n"));
  });

  it("quotes names holding a comma or a quote so they survive the round trip", () => {
    expect(teamRosterContent([
      {
        teamId: "team-1",
        ownerDisplayName: "Ty, Jr.",
        teamDisplayName: "The \"Best\" Team",
        draftOrder: "1",
        savedOwnerDisplayName: "Ty, Jr.",
      },
    ])).toBe([
      "teamId,owner,team,role,draftOrder",
      "team-1,\"Ty, Jr.\",\"The \"\"Best\"\" Team\",member,1",
    ].join("\n"));
  });

  it("moves a team to the slot it asks for and closes the gap behind it", () => {
    const moved = withDraftOrderCommitted(withRowEdited(rows, 0, { draftOrder: "2" }), 0);
    expect(moved.map(row => [row.teamId, row.draftOrder])).toEqual([
      ["team-2", "1"],
      ["team-1", "2"],
    ]);
  });

  it("restores the order on screen when the slot is out of range or the row is gone", () => {
    expect(withDraftOrderCommitted(withRowEdited(rows, 0, { draftOrder: "9" }), 0)
      .map(row => row.draftOrder)).toEqual(["1", "2"]);
    expect(withDraftOrderCommitted(rows, 5)).toEqual(rows);
  });

  it("edits one row, keeping its team id and the name already saved", () => {
    expect(withRowEdited(rows, 0, { ownerDisplayName: "Tye" })).toEqual([
      {
        teamId: "team-1",
        ownerDisplayName: "Tye",
        teamDisplayName: "Short King",
        draftOrder: "1",
        savedOwnerDisplayName: "Ty",
      },
      rows[1],
    ]);
  });


});
