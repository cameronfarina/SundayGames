import { describe, expect, it } from "vitest";
import { seasonQueryKeys } from "./seasonQueryKeys";

describe("seasonQueryKeys", () => {
  it("builds stable season-scoped keys and a catalog prefix", () => {
    expect(seasonQueryKeys.onboarding()).toEqual(["onboarding"]);
    expect(seasonQueryKeys.commissionerSeason("season-a"))
      .toEqual(["commissioner", "season", "season-a"]);
    expect(seasonQueryKeys.commissionerKeepers("season-a"))
      .toEqual(["commissioner", "keepers", "season-a"]);
    expect(seasonQueryKeys.commissionerInvitations("season-a"))
      .toEqual(["commissioner", "invitations", "season-a"]);
    expect(seasonQueryKeys.leagueSeason("season-a")).toEqual(["league-season", "season-a"]);
    expect(seasonQueryKeys.seasonTeam("season-a")).toEqual(["season-team", "season-a"]);
    expect(seasonQueryKeys.seasonKeepers("season-a")).toEqual(["season-keepers", "season-a"]);
    expect(seasonQueryKeys.practiceCatalog("season-a", "balanced"))
      .toEqual(["practice", "catalog", "season-a", "balanced"]);
    expect(seasonQueryKeys.practiceCatalogPrefix("season-a"))
      .toEqual(["practice", "catalog", "season-a"]);
  });
});
