import { describe, it, InMemoryPlatformStore, PlatformAppError, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, playerCatalog, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("routes live room commands through commissioner authorization and exports one draft sheet", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password!", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password!", now);
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

    const room = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_100001_2026",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      initialRosters: [
        { teamId: camTeam.id, playerName: "De'Von Achane", position: "RB", price: 50, expectedPrice: 50 },
      ],
      now,
    });

    expect(await app.getLiveDraftRoom({ actorSessionToken: owner04.sessionToken, roomId: room.roomId })).toEqual(room);
    expect(await app.getLiveDraftRoom({ actorSessionToken: owner04.sessionToken, roomId: room.roomId })).not.toBe(room);
    await expect(
      app.startLiveDraftRoom({
        actorSessionToken: owner04.sessionToken,
        roomId: room.roomId,
        expectedRevision: 1,
        idempotencyKey: "start-by-owner04",
        now: new Date(now.getTime() + 1_000),
      }),
    ).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    await app.startLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: 1,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 2_000),
    });
    const sold = await app.logLiveDraftSale({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 3_000),
    });

    expect(sold.projection.teams.find(team => team.ownerDisplayName === "Owner11")).toMatchObject({
      spent: 112,
      budgetRemaining: 88,
    });

    const memberState = await app.getLiveDraftRoomState({
      actorSessionToken: owner04.sessionToken,
      roomId: room.roomId,
    });
    expect(memberState).toMatchObject({
      role: "member",
      canMutateRoom: false,
      selectedTeam: { teamId: sethTeam.id },
      connection: { state: "synchronized", revision: sold.revision },
    });
    expect(JSON.stringify(memberState)).not.toContain("viewerPasswordHashRef");

    const paused = await app.pauseLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: sold.revision,
      idempotencyKey: "pause-room",
      now: new Date(now.getTime() + 4_000),
    });
    await expect(app.resumeLiveDraftRoom({
      actorSessionToken: owner04.sessionToken,
      roomId: room.roomId,
      expectedRevision: paused.revision,
      idempotencyKey: "resume-room-by-member",
      now: new Date(now.getTime() + 5_000),
    })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
    const resumed = await app.resumeLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: paused.revision,
      idempotencyKey: "resume-room",
      now: new Date(now.getTime() + 6_000),
    });
    const pukaSale = resumed.projection.sales.find(sale => sale.playerName === "Puka Nacua");
    if (pukaSale === undefined) throw new Error("Expected Puka sale fixture.");
    const corrected = await app.correctLiveDraftSale({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: resumed.revision,
      idempotencyKey: "correct-puka-sale",
      saleEventId: pukaSale.saleEventId,
      replacementSale: "owner04 puka 41",
      now: new Date(now.getTime() + 7_000),
    });
    expect(corrected.projection.sales).toEqual([
      expect.objectContaining({ ownerDisplayName: "Owner04", playerName: "Puka Nacua", price: 41 }),
    ]);
    const restored = await app.undoLastLiveDraftSale({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: corrected.revision,
      idempotencyKey: "undo-puka-correction",
      now: new Date(now.getTime() + 8_000),
    });
    expect(restored.projection.sales).toEqual([
      expect.objectContaining({ ownerDisplayName: "Owner11", playerName: "Puka Nacua", price: 62 }),
    ]);

    const exportResult = await app.exportLiveDraftRoom({
      actorSessionToken: owner04.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 9_000),
    });
    await expect(app.createLiveDraftRoomExportArtifact({
      actorSessionToken: owner04.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 10_000),
    })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
    const ended = await app.endLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: restored.revision,
      idempotencyKey: "end-room-before-export",
      allowIncomplete: true,
      now: new Date(now.getTime() + 11_000),
    });
    await expect(app.createLiveDraftRoomExportArtifact({
      actorSessionToken: owner04.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 12_000),
    })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
    await expect(app.createLiveDraftRoomExportArtifact({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 13_000),
    })).rejects.toThrow(new PlatformAppError(
      "draft_room_not_final",
      "Final export requires every team to fill every roster slot.",
    ));
    const reopened = await app.reopenLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: ended.revision,
      idempotencyKey: "reopen-room-after-emergency-end",
      now: new Date(now.getTime() + 14_000),
    });

    expect(exportResult.sheetName).toBe("Draft Results");
    expect(exportResult.table[0]?.slice(0, 2)).toEqual(["League", "League 100001"]);

    const teamHeaderRow = exportResult.table[5];
    if (teamHeaderRow === undefined) throw new Error("Expected team header row.");
    const camColumn = teamHeaderRow.indexOf("Owner11");
    expect(camColumn).toBeGreaterThanOrEqual(0);

    const rb1Row = exportResult.table.find(row => row[0] === "RB1");
    const wr1Row = exportResult.table.find(row => row[0] === "WR1");
    expect(rb1Row?.slice(camColumn, camColumn + 3)).toEqual(["RB1", "De'Von Achane", 50]);
    expect(wr1Row?.slice(camColumn, camColumn + 3)).toEqual(["WR1", "Puka Nacua", 62]);
    expect(exportResult.csv).toContain("Puka Nacua,62");
    expect(reopened).toMatchObject({ status: "paused", revision: ended.revision + 1 });
    expect(reopened.endedAt).toBeUndefined();
  });
});
