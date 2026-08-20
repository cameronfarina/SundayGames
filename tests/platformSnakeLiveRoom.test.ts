import { describe, expect, it } from "vitest";
import { InMemoryLiveDraftRoomRepository } from "../src/platform/liveDraftRooms.js";
import { LiveDraftRoomError } from "../src/platform/liveDraftRooms.js";
import {
  commissioner,
  createRoom,
  now,
  playerCatalog,
  publishedSnakeSeason,
  startRoom,
} from "./platformLiveDraftRooms/fixtures.js";

const snakeRoom = () => {
  const repository = new InMemoryLiveDraftRoomRepository();
  const room = createRoom(repository, { season: publishedSnakeSeason() });
  startRoom(repository);
  return { repository, room };
};

const firstTwoPlayers = () => {
  const [first, second] = playerCatalog;
  if (first === undefined || second === undefined) throw new Error("Expected catalog players.");
  return { first, second };
};

describe("snake live draft room", () => {
  it("skips keeper slots and preserves picks through undo, correction, pause, and end", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSnakeSeason();
    const firstTeam = season.teams[0];
    if (firstTeam === undefined) throw new Error("Expected a first snake team.");
    const room = createRoom(repository, {
      season,
      initialRosters: [{
        teamId: firstTeam.id,
        playerName: "Puka Nacua",
        position: "WR",
        price: 1,
        keeperRound: 1,
        source: "keeper",
      }],
    });

    expect(room.projection.picks?.[0]).toMatchObject({
      overall: 1,
      playerName: "Puka Nacua",
      source: "keeper",
    });
    expect(room.projection.onTheClock).toMatchObject({ overall: 2 });
    startRoom(repository);
    const onTheClock = room.projection.picks?.[1];
    if (onTheClock === undefined) throw new Error("Expected a second snake pick.");
    const picked = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "pick:lifecycle:first",
      sale: { teamId: onTheClock.teamId, playerName: "Xavier Legette" },
      now: new Date(now.getTime() + 2_000),
    });
    const undone = repository.undoLastSale({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 3,
      idempotencyKey: "pick:lifecycle:undo",
    });

    expect(undone.projection.onTheClock).toMatchObject({ overall: 2 });
    const repicked = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "pick:lifecycle:second",
      sale: { teamId: onTheClock.teamId, playerName: "Xavier Legette" },
    });
    const originalPick = repicked.events.at(-1);
    if (originalPick?.type !== "sale_logged") throw new Error("Expected a recorded pick event.");
    const corrected = repository.correctSale({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 5,
      idempotencyKey: "pick:lifecycle:correct",
      saleEventId: originalPick.id,
      replacementSale: { teamId: onTheClock.teamId, playerName: "Amon-Ra St. Brown" },
    });

    expect(corrected.projection.picks?.[1]).toMatchObject({
      overall: 2,
      playerName: "Amon-Ra St. Brown",
      source: "sale",
    });
    expect(corrected.projection.sales.at(-1)?.price).toBeUndefined();
    expect(corrected.projection.onTheClock).toMatchObject({ overall: 3 });
    const paused = repository.pauseRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 6,
      idempotencyKey: "pick:lifecycle:pause",
    });
    const resumed = repository.resumeRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 7,
      idempotencyKey: "pick:lifecycle:resume",
    });
    const ended = repository.endRoom({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 8,
      idempotencyKey: "pick:lifecycle:end",
      allowIncomplete: true,
    });

    expect(paused.status).toBe("paused");
    expect(resumed.status).toBe("live");
    expect(ended).toMatchObject({ status: "ended", revision: 9 });
  });

  it("records a pick without a price and moves the clock on", () => {
    const { repository, room } = snakeRoom();
    const onTheClock = room.projection.onTheClock;
    if (onTheClock === undefined) throw new Error("Expected a team on the clock.");
    const { first } = firstTwoPlayers();

    const updated = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "pick:1",
      sale: { teamId: onTheClock.teamId, playerName: first.name },
      now: new Date(now.getTime() + 2_000),
    });

    expect(updated.projection.sales[0]?.price).toBeUndefined();
    expect(updated.projection.picks?.[0]).toMatchObject({
      playerName: first.name,
      source: "sale",
      overall: 1,
    });
    expect(updated.projection.onTheClock?.overall).toBe(2);
  });

  it("refuses a pick from a team that is not on the clock", () => {
    const { repository, room } = snakeRoom();
    const onTheClock = room.projection.onTheClock;
    const waiting = room.projection.teams.find(team => team.teamId !== onTheClock?.teamId);
    if (waiting === undefined) throw new Error("Expected a waiting team.");
    const { first } = firstTwoPlayers();

    expect(() => repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "pick:out-of-turn",
      sale: { teamId: waiting.teamId, playerName: first.name },
      now: new Date(now.getTime() + 2_000),
    })).toThrow(LiveDraftRoomError);
  });

  it("lets the manager on the clock record their own pick", () => {
    const { repository, room } = snakeRoom();
    const onTheClock = room.projection.onTheClock;
    if (onTheClock === undefined) throw new Error("Expected a team on the clock.");
    const { first } = firstTwoPlayers();

    const updated = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: {
        userId: "user_manager",
        leagueId: "league-100001",
        role: "member",
        teamId: onTheClock.teamId,
      },
      expectedRevision: 2,
      idempotencyKey: "pick:own",
      sale: { teamId: onTheClock.teamId, playerName: first.name },
      now: new Date(now.getTime() + 2_000),
    });

    expect(updated.projection.picks?.[0]?.playerName).toBe(first.name);
  });

  it("still refuses a member who manages a team that is waiting", () => {
    const { repository, room } = snakeRoom();
    const onTheClock = room.projection.onTheClock;
    const waiting = room.projection.teams.find(team => team.teamId !== onTheClock?.teamId);
    if (onTheClock === undefined || waiting === undefined) throw new Error("Expected two teams.");
    const { first } = firstTwoPlayers();

    expect(() => repository.logSaleCommand({
      roomId: "room_sunday",
      actor: {
        userId: "user_waiting",
        leagueId: "league-100001",
        role: "member",
        teamId: waiting.teamId,
      },
      expectedRevision: 2,
      idempotencyKey: "pick:denied",
      sale: { teamId: onTheClock.teamId, playerName: first.name },
      now: new Date(now.getTime() + 2_000),
    })).toThrow(new LiveDraftRoomError(
      "mutation_denied",
      "Only the commissioner or league admins can change this draft room.",
    ));
  });

  it("does not let an observer pick for a team they can view", () => {
    const { repository, room } = snakeRoom();
    const onTheClock = room.projection.onTheClock;
    if (onTheClock === undefined) throw new Error("Expected a team on the clock.");
    const { first } = firstTwoPlayers();

    expect(() => repository.logSaleCommand({
      roomId: "room_sunday",
      actor: {
        userId: "user_observer",
        leagueId: "league-100001",
        role: "observer",
        teamId: onTheClock.teamId,
      },
      expectedRevision: 2,
      idempotencyKey: "pick:observer-denied",
      sale: { teamId: onTheClock.teamId, playerName: first.name },
    })).toThrow(new LiveDraftRoomError(
      "mutation_denied",
      "Only the commissioner or league admins can change this draft room.",
    ));
  });
});
