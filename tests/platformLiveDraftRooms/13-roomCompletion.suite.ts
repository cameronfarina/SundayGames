import { describe, expect, it } from "vitest";
import {
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  member,
  now,
  startRoom,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("undoes the last sale and ends the room", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);
    repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 2_000),
    });

    const undone = repository.undoLastSale({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 3,
      idempotencyKey: "undo:puka:62",
      now: new Date(now.getTime() + 3_000),
    });

    expect(undone.revision).toBe(4);
    expect(undone.projection.sales).toEqual([]);
    expect(undone.projection.teams.find(team => team.ownerDisplayName === "Owner11")).toMatchObject({
      spent: 0,
      budgetRemaining: 200,
      maxBid: 185,
    });
    expect(undone.projection.board.map(player => player.name)).toContain("Puka Nacua");
    expect(undone.events.map(event => event.type)).toEqual([
      "room_created",
      "room_started",
      "sale_logged",
      "sale_undone",
    ]);

    expect(() => repository.endRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "end:room_sunday:without-override",
      now: new Date(now.getTime() + 4_000),
    })).toThrowError(expect.objectContaining({
      code: "draft_incomplete",
      message: expect.stringMatching(
        /Draft is incomplete: 14 teams have open roster slots: Owner01 \(16\).+Owner11 \(16\)/,
      ),
    }));

    const ended = repository.endRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "end:room_sunday",
      allowIncomplete: true,
      now: new Date(now.getTime() + 4_000),
    });

    expect(ended.status).toBe("ended");
    expect(ended.revision).toBe(5);
    expect(ended.events.at(-1)).toMatchObject({
      type: "room_ended",
      revision: 5,
      incomplete: true,
      incompleteTeams: expect.arrayContaining([
        expect.objectContaining({
          ownerDisplayName: "Owner11",
          openRosterSlots: 16,
        }),
      ]),
    });

    expect(() => repository.reopenRoom({
      roomId: "room_sunday",
      actor: member,
      expectedRevision: 5,
      idempotencyKey: "reopen:member",
    })).toThrow(new LiveDraftRoomError(
      "mutation_denied",
      "Only the commissioner or league admins can change this draft room.",
    ));

    const reopened = repository.reopenRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 5,
      idempotencyKey: "reopen:room_sunday",
      now: new Date(now.getTime() + 5_000),
    });

    expect(reopened).toMatchObject({ status: "paused", revision: 6 });
    expect(reopened.endedAt).toBeUndefined();
    expect(reopened.events.at(-1)).toMatchObject({ type: "room_reopened", revision: 6 });

    const resumed = repository.resumeRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 6,
      idempotencyKey: "resume:reopened-room",
      now: new Date(now.getTime() + 6_000),
    });
    expect(resumed.status).toBe("live");
  });
});
