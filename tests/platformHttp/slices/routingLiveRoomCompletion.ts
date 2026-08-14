import { expect, expectBodyRecord, expectPublicBrowserPayload, expectRecordArray, expectString, now } from "../support/index.js";
import type { RoutingContext } from "./routingContext.js";

export const verifyRoutingLiveRoomCompletion = async ({ handle, owner11, owner04, season, camTeam }: RoutingContext): Promise<void> => {
    const undoneRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/undo",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 5,
        idempotencyKey: "undo:puka:62",
        now: new Date(now.getTime() + 6_000),
      },
    });

    expect(undoneRoom.body).toMatchObject({
      room: expect.objectContaining({
        revision: 6,
        salesLog: [],
      }),
    });
    expectPublicBrowserPayload(undoneRoom.body);

    const resoldRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/sales",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 6,
        idempotencyKey: "sale:puka:62:after-undo",
        sale: "owner11 puka 62",
        now: new Date(now.getTime() + 7_000),
      },
    });

    const resoldRoomBody = expectBodyRecord(resoldRoom.body);
    const resoldRoomRecord = expectBodyRecord(resoldRoomBody.room);
    const resoldSales = expectRecordArray(resoldRoomRecord.salesLog);
    const resoldSale = resoldSales[0];
    if (resoldSale === undefined) throw new Error("Expected the replacement sale fixture.");
    const resoldSaleEventId = expectString(resoldSale.saleEventId);
    expectPublicBrowserPayload(resoldRoom.body);

    const correctedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/corrections",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 7,
        idempotencyKey: "correct:puka:owner04:41",
        saleEventId: resoldSaleEventId,
        replacementSale: "owner04 puka 41",
        now: new Date(now.getTime() + 7_250),
      },
    });
    expect(correctedRoom.body).toMatchObject({
      room: expect.objectContaining({
        revision: 8,
        salesLog: [expect.objectContaining({ ownerDisplayName: "Owner04", price: 41 })],
      }),
    });
    expectPublicBrowserPayload(correctedRoom.body);

    const undoneCorrection = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/undo",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 8,
        idempotencyKey: "undo:correction:puka",
        now: new Date(now.getTime() + 7_400),
      },
    });
    expect(undoneCorrection.body).toMatchObject({
      room: expect.objectContaining({
        revision: 9,
        salesLog: [expect.objectContaining({ ownerDisplayName: "Owner11", price: 62 })],
      }),
    });
    expectPublicBrowserPayload(undoneCorrection.body);

    const memberExportArtifact = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/export-artifacts",
      sessionToken: owner04.sessionToken,
      body: {
        exportedAt: new Date(now.getTime() + 7_500).toISOString(),
      },
    });

    expect(memberExportArtifact).toEqual({
      status: 403,
      body: {
        error: {
          code: "shared_mutation_denied",
          message: "Only league owners and admins can change shared draft data.",
        },
      },
    });

    const earlyExportArtifact = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/export-artifacts",
      sessionToken: owner11.sessionToken,
      body: {
        exportedAt: new Date(now.getTime() + 7_500).toISOString(),
      },
    });

    expect(earlyExportArtifact).toEqual({
      status: 409,
      body: {
        error: {
          code: "draft_room_not_final",
          message: "Draft room must be ended before creating a final export artifact.",
        },
      },
    });

    const endedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/end",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 9,
        idempotencyKey: "end-room",
        allowIncomplete: true,
        now: new Date(now.getTime() + 8_000),
      },
    });

    expect(endedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "ended", revision: 10 }),
    });
    expectPublicBrowserPayload(endedRoom.body);

    const myTeam = await handle({
      method: "GET",
      path: "/live-rooms/room_100001_2026/my-team",
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 8_500),
    });
    expect(myTeam).toMatchObject({
      status: 200,
      body: {
        roster: {
          teamId: camTeam.id,
          players: expect.arrayContaining([expect.objectContaining({ playerName: "De'Von Achane" })]),
        },
        analysis: {
          ownership: { userId: owner11.account.id, teamId: camTeam.id },
          ranking: {
            status: "unavailable",
            teamCount: season.teams.length,
            reasons: [expect.objectContaining({ code: "roster_materially_incomplete" })],
          },
          strengths: [],
        },
      },
    });

    const exportedRoom = await handle({
      method: "GET",
      path: "/live-rooms/room_100001_2026/export?exportedAt=2026-08-09T12%3A00%3A09.000Z",
      sessionToken: owner04.sessionToken,
    });

    expect(exportedRoom.body).toMatchObject({
      draftExport: expect.objectContaining({
        sheetName: "Draft Results",
        csv: expect.stringContaining("Puka Nacua,62"),
      }),
    });

    const exportArtifact = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/export-artifacts",
      sessionToken: owner11.sessionToken,
      body: {
        exportedAt: "2026-08-09T12:00:10.000Z",
      },
    });
    expect(exportArtifact).toEqual({
      status: 409,
      body: {
        error: {
          code: "draft_room_not_final",
          message: "Final export requires every team to fill every roster slot.",
        },
      },
    });

    const reopenedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/reopen",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 10,
        idempotencyKey: "reopen-room",
        now: new Date(now.getTime() + 11_000),
      },
    });
    expect(reopenedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "paused", revision: 11 }),
    });
    expectPublicBrowserPayload(reopenedRoom.body);
};
