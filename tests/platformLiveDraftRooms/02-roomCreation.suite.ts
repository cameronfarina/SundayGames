import { describe, expect, it } from "vitest";
import {
  buildCurrentMockdLeagueSeason,
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  leagueConfig,
  LiveDraftRoomError,
  member,
  nonMember,
  now,
  ownerOrder,
  startRoom,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("creates rooms only from ready published seasons and starts with revisioned events", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const room = createRoom(repository);

    expect(room).toMatchObject({
      roomId: "room_sunday",
      leagueId: "league-100001",
      seasonId: "league-100001-season-2026",
      status: "setup",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
    expect(room.projection.teams).toHaveLength(ownerOrder.length);
    expect(room.events.map(event => event.type)).toEqual(["room_created"]);
    expect(repository.getRoomForActor({ roomId: "room_sunday", actor: member })).toBe(room);
    expect(() =>
      repository.getRoomForActor({ roomId: "room_sunday", actor: nonMember }),
    ).toThrow(new LiveDraftRoomError("access_denied", "Only league members can view this draft room."));

    const started = startRoom(repository);

    expect(started.status).toBe("live");
    expect(started.revision).toBe(2);
    expect(started.events.map(event => event.type)).toEqual(["room_created", "room_started"]);

    expect(() =>
      createRoom(repository, {
        season: buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" }),
        roomId: "room_not_ready",
      }),
    ).toThrow(new LiveDraftRoomError(
      "season_not_ready",
      "League season must be published or locked before creating a live draft room.",
    ));

    expect(() => createRoom(repository)).toThrow(new LiveDraftRoomError(
      "room_already_exists",
      "Live draft room \"room_sunday\" already exists.",
    ));
    expect(() => createRoom(repository, { roomId: "room_same_season" })).toThrow(
      new LiveDraftRoomError(
        "room_already_exists",
        'A live draft room already exists for season "league-100001-season-2026".',
      ),
    );

    expect(() =>
      repository.startRoom({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        idempotencyKey: "start:room_sunday:already-live",
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new LiveDraftRoomError("room_already_live", "Draft room has already started."));
  });
});
