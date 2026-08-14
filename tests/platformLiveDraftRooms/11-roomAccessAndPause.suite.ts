import { describe, expect, it } from "vitest";
import {
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  member,
  nonMember,
  now,
  startRoom,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("denies member mutations and stale revisions", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: member,
        expectedRevision: 1,
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new LiveDraftRoomError("mutation_denied", "Only the commissioner or league admins can change this draft room."));

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: nonMember,
        expectedRevision: 1,
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new LiveDraftRoomError("mutation_denied", "Only the commissioner or league admins can change this draft room."));

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 0,
        idempotencyKey: "start:room_sunday:stale",
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new LiveDraftRoomError(
      "stale_revision",
      "Draft room changed since this action was prepared. Refresh and try again.",
    ));
  });

  it("pauses and resumes a live room while freezing sale mutations", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);

    const pauseInput: Parameters<InMemoryLiveDraftRoomRepository["pauseRoom"]>[0] = {
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "pause:room_sunday",
      now: new Date(now.getTime() + 2_000),
    };
    const paused = repository.pauseRoom(pauseInput);

    expect(paused).toMatchObject({ status: "paused", revision: 3 });
    expect(paused.events.at(-1)).toMatchObject({ type: "room_paused", revision: 3 });
    expect(repository.pauseRoom(pauseInput)).toBe(paused);
    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 3,
        idempotencyKey: "sale:while-paused",
        sale: "owner11 puka 62",
      }),
    ).toThrow(new LiveDraftRoomError(
      "room_paused",
      "Resume the draft room before changing sales.",
    ));

    const resumed = repository.resumeRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 3,
      idempotencyKey: "resume:room_sunday",
      now: new Date(now.getTime() + 3_000),
    });

    expect(resumed).toMatchObject({ status: "live", revision: 4 });
    expect(resumed.events.at(-1)).toMatchObject({ type: "room_resumed", revision: 4 });
    expect(repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "sale:after-resume",
      sale: "owner11 puka 62",
    }).projection.sales).toHaveLength(1);
  });
});
