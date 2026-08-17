import { describe, expect, it } from "vitest";
import type { TeamAssignment } from "../api/importSchemas";
import { teamAssignmentSummary } from "./teamAssignmentSummary";

const assignment = (overrides: Partial<TeamAssignment> = {}): TeamAssignment => ({
  sourceRowNumber: 2,
  ownerDisplayName: "Tye",
  teamDisplayName: "Short King",
  effect: "kept",
  ...overrides,
});

describe("teamAssignmentSummary", () => {
  it("says a manager keeps their own team", () => {
    expect(teamAssignmentSummary(assignment({ ownerDisplayName: "Seth" })))
      .toBe("Seth keeps their team.");
  });

  it("names the team a renamed manager takes over", () => {
    expect(teamAssignmentSummary(assignment({
      effect: "renamed",
      previousOwnerDisplayName: "ty",
      previousTeamDisplayName: "Short King",
    }))).toBe("Tye takes over ty's team (Short King), keeping its keepers.");
  });

  it("falls back when the replaced team is unnamed", () => {
    expect(teamAssignmentSummary(assignment({ effect: "renamed" })))
      .toBe("Tye takes over an existing manager's team, keeping its keepers.");
  });

  it("warns that a new team starts with no keepers", () => {
    expect(teamAssignmentSummary(assignment({ effect: "new" })))
      .toBe("Tye starts a new team with no keepers.");
  });
});
