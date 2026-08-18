import { describe, expect, it } from "vitest";
import {
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  member,
  now,
  publishedSnakeSeason,
  startRoom,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("stores a snake hosted room and its creation event", () => {
    const repository = new InMemoryLiveDraftRoomRepository();

    const room = createRoom(repository, {
      season: publishedSnakeSeason(),
      roomId: "room_snake",
    });

    expect(room.roomId).toBe("room_snake");
    expect(repository.rooms()).toHaveLength(1);
  });

  it("cancels only setup rooms and unlocks their season for replacement", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const room = createRoom(repository);
    const cancellation: Parameters<InMemoryLiveDraftRoomRepository["cancelRoom"]>[0] = {
      roomId: room.roomId,
      actor: commissioner,
      expectedRevision: room.revision,
      idempotencyKey: "cancel:room_sunday",
      now: new Date(now.getTime() + 1_000),
    };

    expect(repository.hasRoomForSeason(room.seasonId)).toBe(true);
    expect(repository.cancelRoom(cancellation)).toBeUndefined();
    expect(repository.hasRoomForSeason(room.seasonId)).toBe(false);
    expect(repository.rooms()).toEqual([]);
    expect(() => repository.getRoom(room.roomId)).toThrow(new LiveDraftRoomError(
      "room_not_found",
      'Live draft room "room_sunday" was not found.',
    ));

    expect(repository.cancelRoom(cancellation)).toBeUndefined();
    expect(createRoom(repository)).toMatchObject({ roomId: room.roomId, seasonId: room.seasonId });
  });

  it("authorizes setup-room cancellation and preserves revision checks", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const room = createRoom(repository);

    expect(() => repository.cancelRoom({
      roomId: room.roomId,
      actor: member,
      expectedRevision: room.revision,
      idempotencyKey: "cancel:member",
    })).toThrow(new LiveDraftRoomError(
      "mutation_denied",
      "Only the commissioner or league admins can change this draft room.",
    ));
    expect(() => repository.cancelRoom({
      roomId: room.roomId,
      actor: commissioner,
      expectedRevision: room.revision - 1,
      idempotencyKey: "cancel:stale",
    })).toThrow(new LiveDraftRoomError(
      "stale_revision",
      "Draft room changed since this action was prepared. Refresh and try again.",
    ));
    expect(repository.cancelRoom({
      roomId: room.roomId,
      actor: { ...commissioner, role: "member" },
      expectedRevision: room.revision,
      idempotencyKey: "cancel:commissioner",
    })).toBeUndefined();
    expect(repository.hasRoomForSeason(room.seasonId)).toBe(false);
  });

  it("allows cancellation during countdown but rejects it after a start event", () => {
    const countdownRepository = new InMemoryLiveDraftRoomRepository();
    const countdownRoom = createRoom(countdownRepository, {
      startsAt: new Date(now.getTime() + 60_000),
    });

    expect(countdownRepository.cancelRoom({
      roomId: countdownRoom.roomId,
      actor: commissioner,
      expectedRevision: countdownRoom.revision,
      idempotencyKey: "cancel:countdown",
    })).toBeUndefined();
    expect(countdownRepository.hasRoomForSeason(countdownRoom.seasonId)).toBe(false);

    const liveRepository = new InMemoryLiveDraftRoomRepository();
    createRoom(liveRepository);
    const started = startRoom(liveRepository);

    expect(() => liveRepository.cancelRoom({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "cancel:started",
    })).toThrow(new LiveDraftRoomError(
      "room_not_cancellable",
      "Only a draft room that has never started can be cancelled.",
    ));
    expect(liveRepository.hasRoomForSeason(started.seasonId)).toBe(true);
  });
});
