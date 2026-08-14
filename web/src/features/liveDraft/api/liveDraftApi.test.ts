import { describe, expect, it, vi } from "vitest";
import type { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import {
  createLiveDraftExport,
  getLiveDraftEvents,
  getLiveDraftRoom,
  mutateLiveDraftRoom,
} from "./liveDraftApi";
import { liveRoom } from "../test/liveDraftFixtures";

const okResponse = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  }));

describe("live draft API", () => {
  it("loads the requested room and viewed team", async () => {
    const fetcher = vi.fn(() => okResponse({ room: liveRoom }));
    const signal = new AbortController().signal;

    await expect(getLiveDraftRoom("room/1", "team/2", { fetcher, signal }))
      .resolves.toEqual(liveRoom);
    expect(fetcher).toHaveBeenCalledWith(
      "/live-rooms/room%2F1?viewedTeamId=team%2F2",
      expect.objectContaining({ credentials: "same-origin", signal }),
    );
  });

  it("loads room event metadata after a revision", async () => {
    const events = {
      currentRevision: 2,
      isStale: false,
      requiresSnapshot: false,
      events: [],
    };
    const fetcher = vi.fn(() => okResponse({ events }));

    await expect(getLiveDraftEvents("room-1", 2, { fetcher })).resolves.toEqual(events);
    expect(fetcher).toHaveBeenCalledWith(
      "/live-rooms/room-1/events?afterRevision=2",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("posts lifecycle and sale mutations with concurrency controls", async () => {
    const fetcher = vi.fn(() => okResponse({ room: { ...liveRoom, revision: 3 } }));

    await expect(mutateLiveDraftRoom({
      action: "sales",
      command: "Cam drafted Puka Nacua for 62",
      expectedRevision: 2,
      fetcher,
      idempotencyKey: "sale-1",
      roomId: "room-1",
    })).resolves.toMatchObject({ revision: 3 });
    expect(fetcher).toHaveBeenCalledWith("/live-rooms/room-1/sales", expect.objectContaining({
      body: JSON.stringify({
        expectedRevision: 2,
        idempotencyKey: "sale-1",
        command: "Cam drafted Puka Nacua for 62",
      }),
      method: "POST",
    }));
  });

  it("posts corrections and explicit incomplete endings", async () => {
    const fetcher = vi.fn(() => okResponse({ room: liveRoom }));

    await mutateLiveDraftRoom({
      action: "corrections",
      expectedRevision: 2,
      fetcher,
      idempotencyKey: "correct-1",
      replacementSale: "Seth drafted Puka Nacua for 61",
      roomId: "room-1",
      saleEventId: "sale-1",
    });
    await mutateLiveDraftRoom({
      action: "end",
      allowIncomplete: true,
      expectedRevision: 2,
      fetcher,
      idempotencyKey: "end-1",
      roomId: "room-1",
    });

    expect(fetcher).toHaveBeenNthCalledWith(1, "/live-rooms/room-1/corrections", expect.objectContaining({
      body: JSON.stringify({
        expectedRevision: 2,
        idempotencyKey: "correct-1",
        saleEventId: "sale-1",
        replacementSale: "Seth drafted Puka Nacua for 61",
      }),
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, "/live-rooms/room-1/end", expect.objectContaining({
      body: JSON.stringify({
        expectedRevision: 2,
        idempotencyKey: "end-1",
        allowIncomplete: true,
      }),
    }));
  });

  it("surfaces typed server mutation errors", async () => {
    const fetcher = vi.fn(() => okResponse({
      error: { code: "stale_revision", message: "The room changed." },
    }, 409));

    const request = mutateLiveDraftRoom({
      action: "start",
      expectedRevision: 2,
      fetcher,
      idempotencyKey: "start-1",
      roomId: "room-1",
    });

    await expect(request).rejects.toEqual(expect.objectContaining<Partial<PlatformApiError>>({
      code: "stale_revision",
      message: "The room changed.",
    }));
  });

  it("creates a typed final CSV artifact", async () => {
    const artifact = {
      id: "export-1",
      leagueId: "league-1",
      seasonId: "season-1",
      roomId: "room-1",
      format: "csv",
      sourceRevision: 9,
      createdAt: "2026-08-13T20:00:00.000Z",
      storageKey: "exports/room-1.csv",
      sha256: "abc",
      byteLength: 12,
      contentType: "text/csv; charset=utf-8",
    };
    const fetcher = vi.fn(() => okResponse({ artifact, content: "Player,Price" }, 201));

    await expect(createLiveDraftExport("room-1", "2026-08-13T20:00:00.000Z", { fetcher }))
      .resolves.toEqual({ artifact, content: "Player,Price" });
  });
});
