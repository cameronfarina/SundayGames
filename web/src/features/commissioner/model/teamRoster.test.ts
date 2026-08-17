import { describe, expect, it } from "vitest";
import { auctionSeason } from "../test/commissionerFixtures";
import {
  teamRosterContent,
  teamRosterRows,
  withRowEdited,
  withRowMoved,
  type TeamRosterRow,
} from "./teamRoster";

const rows: TeamRosterRow[] = [
  { teamId: "team-1", ownerDisplayName: "Ty", teamDisplayName: "Short King" },
  { teamId: "team-2", ownerDisplayName: "Bob", teamDisplayName: "Bob's Team" },
];

describe("teamRoster", () => {
  it("reads each team into a row that remembers its team id", () => {
    expect(teamRosterRows(auctionSeason)).toEqual([
      { teamId: "team-1", ownerDisplayName: "Owner11", teamDisplayName: "Short King" },
    ]);
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
      { teamId: "team-1", ownerDisplayName: "Ty, Jr.", teamDisplayName: "The \"Best\" Team" },
    ])).toBe([
      "teamId,owner,team,role",
      "team-1,\"Ty, Jr.\",\"The \"\"Best\"\" Team\",member",
    ].join("\n"));
  });

  it("edits one row and leaves its team id alone", () => {
    expect(withRowEdited(rows, 0, { ownerDisplayName: "Tye" })).toEqual([
      { teamId: "team-1", ownerDisplayName: "Tye", teamDisplayName: "Short King" },
      rows[1],
    ]);
  });

  it("swaps two rows to change draft order and ignores a move off either end", () => {
    expect(withRowMoved(rows, 0, 1)).toEqual([rows[1], rows[0]]);
    expect(withRowMoved(rows, 0, -1)).toEqual(rows);
    expect(withRowMoved(rows, 1, 1)).toEqual(rows);
  });

  it("leaves the rows either side of a swap where they were", () => {
    const third = { teamId: "team-3", ownerDisplayName: "Sue", teamDisplayName: "Sue's Team" };

    expect(withRowMoved([...rows, third], 2, -1)).toEqual([rows[0], third, rows[1]]);
  });
});
