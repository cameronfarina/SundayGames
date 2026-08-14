import { expect, expectAsyncTextStream, expectPublicBrowserPayload, now } from "../support/index.js";
import type { RoutingContext } from "./routingContext.js";

export const verifyRoutingLiveRoomSales = async ({ handle, owner11, owner04, camTeam, sethTeam }: RoutingContext): Promise<void> => {
    const mismatchedStructuredSale = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/sales",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 4,
        idempotencyKey: "sale:mismatched-team-owner",
        structuredSale: {
          teamId: camTeam.id,
          ownerId: sethTeam.ownerId,
          playerName: "Puka Nacua",
          price: 1,
        },
        now: new Date(now.getTime() + 4_100),
      },
    });

    expect(mismatchedStructuredSale).toEqual({
      status: 400,
      body: {
        error: {
          code: "team_not_found",
          message: `Sale team does not match owner "${sethTeam.ownerId}".`,
        },
      },
    });

    const missingSaleRevision = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/sales",
      sessionToken: owner11.sessionToken,
      body: {
        idempotencyKey: "sale:puka:missing-revision",
        command: "owner11 puka 62",
        now: new Date(now.getTime() + 4_500),
      },
    });

    expect(missingSaleRevision).toEqual({
      status: 400,
      body: {
        error: {
          code: "expected_revision_required",
          message: "Draft room mutation requires the current revision.",
        },
      },
    });

    const missingSaleIdempotencyKey = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/sales",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 4,
        command: "owner11 puka 62",
        now: new Date(now.getTime() + 4_600),
      },
    });

    expect(missingSaleIdempotencyKey).toEqual({
      status: 400,
      body: {
        error: {
          code: "idempotency_key_required",
          message: "Draft room mutation requires an idempotency key.",
        },
      },
    });

    const soldRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/sales",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 4,
        idempotencyKey: "sale:puka:62",
        command: "owner11 puka 62",
        now: new Date(now.getTime() + 5_000),
      },
    });

    expect(soldRoom.body).toMatchObject({
      room: expect.objectContaining({
        revision: 5,
        salesLog: [expect.objectContaining({ playerName: "Puka Nacua", price: 62 })],
      }),
    });
    expectPublicBrowserPayload(soldRoom.body);

    const retriedSoldRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_100001_2026/sales",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 4,
        idempotencyKey: "sale:puka:62",
        command: "owner11 puka 62",
        now: new Date(now.getTime() + 5_500),
      },
    });

    expect(retriedSoldRoom.body).toMatchObject({
      room: expect.objectContaining({
        revision: 5,
        salesLog: [expect.objectContaining({ playerName: "Puka Nacua", price: 62 })],
      }),
    });
    expectPublicBrowserPayload(retriedSoldRoom.body);

    const saleEvents = await handle({
      method: "GET",
      path: "/live-rooms/room_100001_2026/events?afterRevision=4",
      sessionToken: owner04.sessionToken,
    });

    expect(saleEvents.body).toMatchObject({
      events: {
        currentRevision: 5,
        isStale: true,
        requiresSnapshot: false,
        events: [
          expect.objectContaining({
            event: "room.sale",
            revision: 5,
            data: expect.objectContaining({
              sale: expect.objectContaining({ playerName: "Puka Nacua", price: 62 }),
            }),
          }),
        ],
      },
    });
    expectPublicBrowserPayload(saleEvents.body);

    const saleEventStream = await handle({
      method: "GET",
      path: "/live-rooms/room_100001_2026/event-stream?afterRevision=4",
      sessionToken: owner04.sessionToken,
    });

    expect(saleEventStream.status).toBe(200);
    expect(saleEventStream.headers).toMatchObject({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "Connection": "keep-alive",
    });
    const saleEventIterator = expectAsyncTextStream(saleEventStream.body)[Symbol.asyncIterator]();
    const firstSaleEvent = await saleEventIterator.next();
    if (firstSaleEvent.done) throw new Error("Expected initial live-room snapshot event.");
    expect(firstSaleEvent.value).toContain("id: room_100001_2026:5:snapshot\n");
    expect(firstSaleEvent.value).toContain("event: room.snapshot\n");
    expect(firstSaleEvent.value).toContain("\"playerName\":\"Puka Nacua\"");
    for (const payload of firstSaleEvent.value
      .split("\n")
      .filter(line => line.startsWith("data: "))
      .map(line => JSON.parse(line.slice("data: ".length)))) {
      expectPublicBrowserPayload(payload);
    }
    await saleEventIterator.return?.();
};
