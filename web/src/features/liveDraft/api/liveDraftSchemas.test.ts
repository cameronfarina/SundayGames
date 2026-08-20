import { describe, expect, it } from "vitest";
import {
  liveDraftEventsResponseSchema,
  liveDraftRoomResponseSchema,
} from "./liveDraftSchemas";
import { liveRoom } from "../test/liveDraftFixtures";

describe("live draft wire schemas", () => {
  it("parses a complete room projection", () => {
    expect(liveDraftRoomResponseSchema.parse({ room: liveRoom })).toEqual({ room: liveRoom });
  });

  it("treats an auction room from the previous server as unable to log snake picks", () => {
    const previousServerRoom: Partial<typeof liveRoom> = { ...liveRoom };
    delete previousServerRoom.canLogPick;

    expect(liveDraftRoomResponseSchema.parse({ room: previousServerRoom }).room)
      .toMatchObject({ canLogPick: false, canMutateRoom: true });
  });

  it("rejects malformed room projections", () => {
    expect(liveDraftRoomResponseSchema.safeParse({
      room: { ...liveRoom, revision: "two" },
    }).success).toBe(false);
  });

  it("parses polling event metadata without trusting event data", () => {
    const body = {
      events: {
        currentRevision: 3,
        isStale: true,
        requiresSnapshot: false,
        events: [{ id: "room-1:3", event: "room.sale", revision: 3 }],
      },
    };

    expect(liveDraftEventsResponseSchema.parse(body)).toEqual(body);
  });
});
