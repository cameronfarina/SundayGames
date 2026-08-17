import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import { leagueSetupTeamAssignments } from "../src/platform/leagueSetupImport/teamAssignmentPreview.js";
import { parseLeagueSetupImport } from "../src/platform/leagueSetupImport.js";

const seasonOfThree = () => buildCurrentMockdLeagueSeason(
  ownerOrder.slice(0, 3),
  { ...leagueConfig, teams: 3 },
  { setupStatus: "published" },
);

const recordsFor = (rows: readonly string[]) => parseLeagueSetupImport(
  ["owner,team,role", ...rows].join("\n"),
  { expectedTeamCount: 3 },
).records;

describe("league setup team assignments", () => {
  it("reports which team each row keeps, renames, or creates", () => {
    const season = seasonOfThree();
    const [first, second] = season.teams;
    if (first === undefined || second === undefined) throw new Error("Expected team fixtures.");

    const assignments = leagueSetupTeamAssignments(season, recordsFor([
      `${first.ownerDisplayName},Alpha,member`,
      "Tye,Bravo,member",
      `${ownerOrder[2] ?? ""},Charlie,member`,
    ]));

    expect(assignments[0]).toMatchObject({ effect: "kept", ownerDisplayName: first.ownerDisplayName });
    expect(assignments[1]).toMatchObject({
      effect: "renamed",
      ownerDisplayName: "Tye",
      existingTeamId: second.id,
      previousOwnerDisplayName: second.ownerDisplayName,
    });
    expect(assignments[2]).toMatchObject({ effect: "kept" });
  });

  it("marks a row as new when every existing team is already claimed", () => {
    const season = seasonOfThree();
    const claimedByName = season.teams.map(team => team.ownerDisplayName);

    const assignments = leagueSetupTeamAssignments(season, recordsFor([
      `${claimedByName[0] ?? ""},Alpha,member`,
      `${claimedByName[1] ?? ""},Bravo,member`,
      `${claimedByName[2] ?? ""},Charlie,member`,
    ]));

    expect(assignments.map(assignment => assignment.effect)).toEqual(["kept", "kept", "kept"]);
  });

  it("never assigns one existing team to two rows", () => {
    const season = seasonOfThree();

    const assignments = leagueSetupTeamAssignments(season, recordsFor([
      "Newcomer One,Alpha,member",
      "Newcomer Two,Bravo,member",
      "Newcomer Three,Charlie,member",
    ]));

    const claimedIds = assignments.flatMap(assignment =>
      assignment.existingTeamId === undefined ? [] : [assignment.existingTeamId]);
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    expect(assignments.every(assignment => assignment.effect === "renamed")).toBe(true);
  });
});
