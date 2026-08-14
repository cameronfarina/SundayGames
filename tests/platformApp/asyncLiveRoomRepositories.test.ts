import { describe, it, AsyncLiveDraftRoomRepository, InMemoryPlatformStore, PlatformAppError, RecordingExportArtifactRepository, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, playerCatalog, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("can route live draft rooms and export artifacts through injected async repositories", async () => {
    const liveDraftRoomRepository = new AsyncLiveDraftRoomRepository();
    const exportArtifactRepository = new RecordingExportArtifactRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      liveDraftRoomRepository,
      exportArtifactRepository,
      simulationRunner: mockRunner,
    });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
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
      roomId: "room_async_repo",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: created.roomId,
      expectedRevision: created.revision,
      idempotencyKey: "start-async-repo-room",
      now: new Date(now.getTime() + 1_000),
    });
    const sold = await app.logLiveDraftSale({
      actorSessionToken: owner11.sessionToken,
      roomId: created.roomId,
      expectedRevision: 2,
      idempotencyKey: "async-repo-sale-puka",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 2_000),
    });
    const ended = await app.endLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: created.roomId,
      expectedRevision: sold.revision,
      idempotencyKey: "end-async-repo-room",
      allowIncomplete: true,
      now: new Date(now.getTime() + 3_000),
    });
    await expect(app.createLiveDraftRoomExportArtifact({
      actorSessionToken: owner11.sessionToken,
      roomId: created.roomId,
      exportedAt: new Date(now.getTime() + 4_000),
    })).rejects.toThrow(new PlatformAppError(
      "draft_room_not_final",
      "Final export requires every team to fill every roster slot.",
    ));

    expect(ended.revision).toBe(4);
    expect(exportArtifactRepository.savedByUserIds).toEqual([]);
    expect(exportArtifactRepository.savedResults).toEqual([]);
    expect(app.store.liveDraftRooms.rooms()).toEqual([]);
    expect(app.store.exportArtifacts.artifacts()).toEqual([]);
  });
});
