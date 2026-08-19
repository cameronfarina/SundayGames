import { describe, it, InMemoryPlatformStore, PlatformAppError, asSnakeSeason, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, playerCatalog, signUpAndLogin } from "./support/index.js";
import type { LeagueSeason } from "../../src/platform/leagueSeason.js";
import type { PlatformLeagueMembership } from "../../src/platform/leagueSetup.js";

const withRounds = (season: LeagueSeason, rounds: number): LeagueSeason => {
  if (season.settings.draftFormat !== "snake") throw new Error("Expected a snake season.");
  return { ...season, settings: { ...season.settings, snake: { ...season.settings.snake, rounds } } };
};

const registerSnakeLeague = async () => {
  const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
  const owner11 = await signUpAndLogin(app, "owner11-rounds@example.com", "owner11 password", now);
  const season = asSnakeSeason(buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "League 100001",
    setupStatus: "published",
  }));
  const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
  if (camTeam === undefined) throw new Error("Expected a fixture team.");
  const memberships: readonly PlatformLeagueMembership[] = [{
    userId: owner11.account.id,
    leagueId: season.leagueId,
    role: "owner",
    ownerId: camTeam.ownerId,
    teamId: camTeam.id,
  }];
  await app.registerLeagueSeason({ actorSessionToken: owner11.sessionToken, season, memberships, now });
  return { app, memberships, owner11, season };
};

describe("platform app service", () => {
  it("changes snake draft rounds while no draft has started", async () => {
    const { app, memberships, owner11, season } = await registerSnakeLeague();

    const updated = await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: withRounds(season, 12),
      memberships,
      now,
    });

    expect(updated.settings.draftFormat === "snake" && updated.settings.snake.rounds).toBe(12);
  });

  it("keeps every other setting editable when the rounds do not move", async () => {
    const { app, memberships, owner11, season } = await registerSnakeLeague();

    const updated = await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: { ...season, setupStatus: "locked" },
      memberships,
      now,
    });

    expect(updated.setupStatus).toBe("locked");
  });

  it("reports a locked round count once the live draft has started", async () => {
    const { app, memberships, owner11, season } = await registerSnakeLeague();
    await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_rounds",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: "room_rounds",
      expectedRevision: 1,
      idempotencyKey: "start:room_rounds",
      now,
    });

    await expect(app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: withRounds(season, 8),
      memberships,
      now,
    })).rejects.toThrow(new PlatformAppError(
      "draft_rounds_locked",
      "Draft rounds cannot change once the live draft has started.",
    ));
  });
});
