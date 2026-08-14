import { describe, expect, it } from "vitest";
import {
  contextTestAccount,
  createRegisteredContextFixture,
} from "./platformAppContextFixtures.js";

describe("platform app context shared access", () => {
  it("enforces mutation roles and supports season lookup through both public selectors", async () => {
    const { context, season, owner, member } = createRegisteredContextFixture();

    await expect(context.requireSharedMutation(owner, season.leagueId)).resolves.toMatchObject({
      userId: owner.id,
      role: "owner",
    });
    await expect(context.requireSharedMutation(member, season.leagueId)).rejects.toMatchObject({
      code: "shared_mutation_denied",
      message: "Only league owners and admins can change shared draft data.",
    });
    const outsider = contextTestAccount("context-outsider");
    await expect(context.requireSharedMutation(outsider, season.leagueId)).rejects.toMatchObject({
      code: "membership_required",
      message: "Join this league before changing shared league data.",
    });
    await expect(context.requireSharedRead(outsider, season.leagueId)).rejects.toMatchObject({
      code: "membership_required",
      message: "Join this league before viewing shared league data.",
    });
    await expect(
      context.requireSeasonForLeagueYear(season.leagueId, season.seasonYear),
    ).resolves.toEqual(season);
    await expect(context.requireSeasonRead(owner, season.id)).resolves.toEqual(season);
  });
});
