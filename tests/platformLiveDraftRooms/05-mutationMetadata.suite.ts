import { describe, expect, it } from "vitest";
import {
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  startRoom,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("requires revision and idempotency metadata for live mutations", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);

    expect(() => repository.cancelRoom({
      roomId: "room_sunday",
      actor: commissioner,
      idempotencyKey: "cancel:missing-revision",
    })).toThrow(new LiveDraftRoomError(
      "expected_revision_required",
      "Draft room mutation requires the current revision.",
    ));

    expect(() => repository.cancelRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 1,
    })).toThrow(new LiveDraftRoomError(
      "idempotency_key_required",
      "Draft room mutation requires an idempotency key.",
    ));

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: commissioner,
        idempotencyKey: "start:missing-revision",
      }),
    ).toThrow(new LiveDraftRoomError(
      "expected_revision_required",
      "Draft room mutation requires the current revision.",
    ));

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 1,
      }),
    ).toThrow(new LiveDraftRoomError(
      "idempotency_key_required",
      "Draft room mutation requires an idempotency key.",
    ));

    startRoom(repository);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        sale: "owner11 puka 62",
      }),
    ).toThrow(new LiveDraftRoomError(
      "idempotency_key_required",
      "Draft room mutation requires an idempotency key.",
    ));
  });
});
