import { describe, expect, it } from "vitest";
import { historicalOwnerNeeds } from "./historicalOwnerNeeds";

const row = (code: string, sourceOwnerOrTeamLabel?: string) => ({
  blockers: [{ code }],
  ...(sourceOwnerOrTeamLabel === undefined ? {} : { identityAudit: { sourceOwnerOrTeamLabel } }),
});

describe("historicalOwnerNeeds", () => {
  it("asks once for each unmapped historical team an owner blocker names", () => {
    const needs = historicalOwnerNeeds({ ownerMappings: {} }, [
      row("owner_unknown", "Old Cam"),
      row("owner_ambiguous", "Old Cam"),
      row("owner_unknown", "Old Seth"),
    ]);

    expect(needs).toEqual(["Old Cam", "Old Seth"]);
  });

  it("skips rows without an owner blocker, rows without a label, and teams already mapped", () => {
    const needs = historicalOwnerNeeds({ ownerMappings: { "Old Cam": "team-1" } }, [
      row("owner_unknown", "Old Cam"),
      row("missing_player", "Old Seth"),
      row("owner_unknown"),
    ]);

    expect(needs).toEqual([]);
  });
});
