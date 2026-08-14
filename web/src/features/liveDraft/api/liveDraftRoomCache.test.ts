import { describe, expect, it } from "vitest";
import { liveRoom } from "../test/liveDraftFixtures";
import { liveDraftRoomSchema } from "./liveDraftSchemas";
import {
  liveDraftRoomCacheUpdate,
  type LiveDraftRoomEventName,
} from "./liveDraftRoomCache";

type RoomStatus = "ended" | "live" | "paused";

const validTransitions: readonly (readonly [LiveDraftRoomEventName, RoomStatus])[] = [
  ["room.started", "live"],
  ["room.resumed", "live"],
  ["room.paused", "paused"],
  ["room.ended", "ended"],
];

const roomAtRevision = (
  revision: number,
  status: RoomStatus = "live",
) =>
  liveDraftRoomSchema.parse({
    ...liveRoom,
    revision,
    status,
    connection: {
      ...liveRoom.connection,
      cursor: `room-1:${String(revision)}`,
      revision,
    },
  });

describe("liveDraftRoomCacheUpdate", () => {
  it("applies contiguous typed updates and lets snapshots bridge revision gaps", () => {
    const saleRoom = roomAtRevision(3);
    const recoveredRoom = roomAtRevision(6, "paused");

    expect(liveDraftRoomCacheUpdate(liveRoom, "room.sale", saleRoom)).toEqual({
      type: "applied",
      room: saleRoom,
    });
    expect(liveDraftRoomCacheUpdate(saleRoom, "room.snapshot", recoveredRoom)).toEqual({
      type: "applied",
      room: recoveredRoom,
    });
  });

  it("ignores duplicate revisions and refetches for gaps or invalid event semantics", () => {
    expect(liveDraftRoomCacheUpdate(liveRoom, "room.sale", liveRoom)).toEqual({ type: "ignored" });
    expect(liveDraftRoomCacheUpdate(liveRoom, "room.sale", roomAtRevision(4))).toEqual({
      type: "refetch",
    });
    expect(liveDraftRoomCacheUpdate(liveRoom, "room.paused", roomAtRevision(3))).toEqual({
      type: "refetch",
    });
    expect(liveDraftRoomCacheUpdate(
      liveRoom,
      "room.sale",
      liveDraftRoomSchema.parse({
        ...roomAtRevision(3),
        connection: { ...liveRoom.connection, cursor: "room-1:2", revision: 2 },
      }),
    )).toEqual({ type: "refetch" });
    expect(liveDraftRoomCacheUpdate(
      liveRoom,
      "room.sale",
      liveDraftRoomSchema.parse({
        ...roomAtRevision(3),
        connection: { ...liveRoom.connection, cursor: "room-2:3", revision: 3 },
        roomId: "room-2",
      }),
    )).toEqual({ type: "refetch" });
    expect(liveDraftRoomCacheUpdate(liveRoom, "room.error", roomAtRevision(3))).toEqual({
      type: "refetch",
    });
    expect(liveDraftRoomCacheUpdate(undefined, "room.snapshot", roomAtRevision(3))).toEqual({
      type: "refetch",
    });
  });

  it.each(validTransitions)("applies a contiguous %s event with matching status", (event, status) => {
    const incoming = roomAtRevision(3, status);
    expect(liveDraftRoomCacheUpdate(liveRoom, event, incoming)).toEqual({
      room: incoming,
      type: "applied",
    });
  });

  it("refetches when an ended event does not contain an ended room", () => {
    expect(liveDraftRoomCacheUpdate(liveRoom, "room.ended", roomAtRevision(3))).toEqual({
      type: "refetch",
    });
  });
});
