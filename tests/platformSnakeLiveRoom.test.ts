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
});
