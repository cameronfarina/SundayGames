import { describe, it, AsyncLiveDraftRoomRepository, InMemoryPlatformStore, LiveDraftRoomError, PlatformAppError, asSnakeSeason, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, playerCatalog, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("rejects snake hosted rooms before delegating creation to the repository", async () => {
    const liveDraftRoomRepository = new AsyncLiveDraftRoomRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      liveDraftRoomRepository,
      simulationRunner: mockRunner,
    });
    const owner11 = await signUpAndLogin(app, "owner11-snake-room@example.com", "owner11 password", now);
    const season = asSnakeSeason(buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Snake League",
      setupStatus: "published",
    }));
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    await expect(app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_snake",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    })).rejects.toThrow(new LiveDraftRoomError(
      "snake_live_room_unavailable",
      "Hosted live rooms currently support auction drafts. Use Mock Draft for this snake league.",
    ));
    expect(liveDraftRoomRepository.createInputs).toEqual([]);
    expect(liveDraftRoomRepository.inner.rooms()).toEqual([]);
  });

  it("cancels a setup room idempotently so league setup can resume and the room can be recreated", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11-cancel@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04-cancel@example.com", "owner04 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });
    const created = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_cancel_setup",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    const cancellation: Parameters<typeof app.cancelLiveDraftRoom>[0] = {
      actorSessionToken: owner11.sessionToken,
      roomId: created.roomId,
      expectedRevision: created.revision,
      idempotencyKey: "cancel:room_cancel_setup",
      now: new Date(now.getTime() + 1_000),
    };

    await expect(app.cancelLiveDraftRoom({
      ...cancellation,
      actorSessionToken: owner04.sessionToken,
    })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
    await expect(app.cancelLiveDraftRoom(cancellation)).resolves.toBeUndefined();
    await expect(app.cancelLiveDraftRoom(cancellation)).resolves.toBeUndefined();
    await expect(app.hasLiveDraftRoomForSeason(season.id)).resolves.toBe(false);
    await expect(app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: created.roomId,
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({ roomId: created.roomId, seasonId: season.id });
  });
});
