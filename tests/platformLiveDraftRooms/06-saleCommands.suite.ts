import { describe, expect, it } from "vitest";
import {
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  now,
  startRoom,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("parses compact sale commands and updates budget, roster, revision, and events", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);

    const room = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 2_000),
    });
    const owner11 = room.projection.teams.find(team => team.ownerDisplayName === "Owner11");

    expect(room.revision).toBe(3);
    expect(room.events.map(event => event.type)).toEqual(["room_created", "room_started", "sale_logged"]);
    expect(room.projection.sales).toEqual([
      expect.objectContaining({
        ownerDisplayName: "Owner11",
        teamDisplayName: "Owner11",
        playerName: "Puka Nacua",
        position: "WR",
        price: 62,
      }),
    ]);
    expect(owner11).toMatchObject({
      ownerDisplayName: "Owner11",
      spent: 62,
      budgetRemaining: 138,
      rosterSlotsRemaining: 15,
      maxBid: 124,
    });
    expect(owner11?.roster).toEqual([
      expect.objectContaining({ name: "Puka Nacua", position: "WR", price: 62 }),
    ]);
    expect(room.projection.board.map(player => player.name)).not.toContain("Puka Nacua");
  });

  it("replays idempotent live mutations instead of double-appending events", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);

    const started = repository.startRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 1,
      idempotencyKey: "start:room_sunday",
      now: new Date(now.getTime() + 1_000),
    });
    const retriedStart = repository.startRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 1,
      idempotencyKey: "start:room_sunday",
      now: new Date(now.getTime() + 2_000),
    });

    expect(retriedStart).toBe(started);
    expect(retriedStart.events.map(event => event.type)).toEqual(["room_created", "room_started"]);

    const sold = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 3_000),
    });
    const retriedSale = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 4_000),
    });

    expect(retriedSale).toBe(sold);
    expect(retriedSale.projection.sales).toHaveLength(1);
    expect(retriedSale.revision).toBe(3);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 3,
        idempotencyKey: "sale:puka:62",
        sale: "owner11 puka 61",
        now: new Date(now.getTime() + 5_000),
      }),
    ).toThrow(new LiveDraftRoomError(
      "idempotency_conflict",
      "A draft room mutation already exists for this idempotency key with different input.",
    ));
  });

  it("accepts already-parsed sale objects", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);

    const room = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:amon-ra:50",
      sale: {
        ownerText: "Owner12",
        playerName: "Amon-Ra St. Brown",
        price: 50,
      },
      now: new Date(now.getTime() + 2_000),
    });

    expect(room.projection.sales).toEqual([
      expect.objectContaining({
        ownerDisplayName: "Owner12",
        playerName: "Amon-Ra St. Brown",
        price: 50,
      }),
    ]);
  });
});
