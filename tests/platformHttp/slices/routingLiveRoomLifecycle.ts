import { expect, expectPublicBrowserPayload, now, playerCatalog } from "../support/index.js";
import type { RoutingContext } from "./routingContext.js";

export const verifyRoutingLiveRoomLifecycle = async ({ handle, owner11, owner04, season, camTeam, sethTeam }: RoutingContext): Promise<void> => {
    await expect(handle({
      method: "POST",
      path: "/live-rooms",
      sessionToken: owner11.sessionToken,
      body: {},
    })).resolves.toMatchObject({ status: 404 });

    const createdRoom = await handle({
      method: "POST",
      path: "/live-rooms",
      sessionToken: owner11.sessionToken,
      headers: { "x-mockd-provisioning-token": "test-provisioning-token" },
      body: {
        seasonId: season.id,
        roomId: "room_100001_2026",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog,
        initialRosters: [
          { teamId: camTeam.id, playerName: "De'Von Achane", position: "RB", price: 50, expectedPrice: 50 },
        ],
        now,
      },
    });

    expect(createdRoom.status).toBe(201);
    expect(createdRoom.body).toMatchObject({
      room: expect.objectContaining({
        roomId: "room_100001_2026",
        status: "setup",
        role: "commissioner",
        canMutateRoom: true,
      }),
    });
    expectPublicBrowserPayload(createdRoom.body);

    const fetchedRoom = await handle({
      method: "GET",
      path: "/live-rooms/room_100001_2026",
      sessionToken: owner04.sessionToken,
    });

    expect(fetchedRoom.body).toMatchObject({
      room: expect.objectContaining({
        roomId: "room_100001_2026",
        role: "member",
        canMutateRoom: false,
      }),
    });
    expectPublicBrowserPayload(fetchedRoom.body);

    const initialEvents = await handle({
      method: "GET",
      path: "/live-rooms/room_100001_2026/events?afterRevision=0",
      sessionToken: owner04.sessionToken,
    });
    expect(initialEvents.body).toMatchObject({
      events: {
        events: [expect.objectContaining({ event: "room.snapshot" })],
      },
    });
    expectPublicBrowserPayload(initialEvents.body);

    const startedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/start",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 1,
        idempotencyKey: "start-room",
        now: new Date(now.getTime() + 4_000),
      },
    });

    expect(startedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "live", revision: 2 }),
    });
    expectPublicBrowserPayload(startedRoom.body);

    const pausedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/pause",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 2,
        idempotencyKey: "pause-room",
        now: new Date(now.getTime() + 4_050),
      },
    });
    expect(pausedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "paused", revision: 3 }),
    });
    expectPublicBrowserPayload(pausedRoom.body);

    const saleWhilePaused = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/sales",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 3,
        idempotencyKey: "sale:while-paused",
        command: "owner11 puka 62",
      },
    });
    expect(saleWhilePaused).toMatchObject({
      status: 409,
      body: { error: { code: "room_paused" } },
    });

    const resumedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/resume",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 3,
        idempotencyKey: "resume-room",
        now: new Date(now.getTime() + 4_075),
      },
    });
    expect(resumedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "live", revision: 4 }),
    });
    expectPublicBrowserPayload(resumedRoom.body);

    const memberRoomState = await handle({
      method: "GET",
      path: `/live-rooms/room_100001_2026/state?selectedTeamId=${encodeURIComponent(sethTeam.id)}`,
      sessionToken: owner04.sessionToken,
    });
    expect(memberRoomState.body).toMatchObject({
      state: expect.objectContaining({
        role: "member",
        canMutateRoom: false,
        selectedTeam: expect.objectContaining({ teamId: sethTeam.id }),
      }),
    });
    expectPublicBrowserPayload(memberRoomState.body);
};
