import { describe, expect, it } from "vitest";
import {
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  now,
  playerCatalog,
  publishedSnakeSeason,
  startRoom,
} from "./platformLiveDraftRooms/fixtures.js";

describe("live snake picks", () => {
  it("drafts for the team on the clock and advances the board", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSnakeSeason();
    createRoom(repository, { season, playerCatalog });
    const started = startRoom(repository);
    const first = started.projection.onTheClock;
    if (first === undefined) throw new Error("Expected a team on the clock.");

    const updated = repository.logPick({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "pick:first",
      now: new Date(now.getTime() + 2_000),
      pick: { playerName: "Puka Nacua" },
    });

    expect(updated.projection.picks?.[0]).toMatchObject({
      overall: first.overall,
      teamId: first.teamId,
      playerName: "Puka Nacua",
      source: "pick",
    });
    expect(updated.projection.teams.find(team => team.teamId === first.teamId)?.roster)
      .toEqual(expect.arrayContaining([expect.objectContaining({ name: "Puka Nacua", source: "pick" })]));
    expect(updated.projection.onTheClock?.overall).toBe(first.overall + 1);
    expect(updated.projection.board.some(player => player.name === "Puka Nacua")).toBe(false);
  });

  it("corrects a pick in place and undo restores the previous selection", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository, { season: publishedSnakeSeason(), playerCatalog });
    const started = startRoom(repository);
    const drafted = repository.logPick({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "pick:first",
      pick: "Puka Nacua",
    });
    const firstPick = drafted.projection.picks?.[0];
    if (firstPick?.pickEventId === undefined) throw new Error("Expected a native pick event.");

    const corrected = repository.correctPick({
      roomId: drafted.roomId,
      actor: commissioner,
      expectedRevision: drafted.revision,
      idempotencyKey: "pick:first:correct",
      pickEventId: firstPick.pickEventId,
      replacementPick: "Jahmyr Gibbs",
    });

    expect(corrected.projection.picks?.[0]?.playerName).toBe("Jahmyr Gibbs");
    expect(corrected.projection.board.some(player => player.name === "Puka Nacua")).toBe(true);
    expect(corrected.projection.board.some(player => player.name === "Jahmyr Gibbs")).toBe(false);

    const undone = repository.undoLastPick({
      roomId: corrected.roomId,
      actor: commissioner,
      expectedRevision: corrected.revision,
      idempotencyKey: "pick:first:undo-correction",
    });

    expect(undone.projection.picks?.[0]?.playerName).toBe("Puka Nacua");
    expect(undone.projection.board.some(player => player.name === "Jahmyr Gibbs")).toBe(true);
  });

  it("undoes the latest pick and puts that team back on the clock", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository, { season: publishedSnakeSeason(), playerCatalog });
    const started = startRoom(repository);
    const first = started.projection.onTheClock;
    if (first === undefined) throw new Error("Expected a team on the clock.");
    const drafted = repository.logPick({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "pick:first",
      pick: "Puka Nacua",
    });

    const undone = repository.undoLastPick({
      roomId: drafted.roomId,
      actor: commissioner,
      expectedRevision: drafted.revision,
      idempotencyKey: "pick:first:undo",
    });

    expect(undone.projection.onTheClock?.overall).toBe(first.overall);
    expect(undone.projection.picks?.[0]?.playerName).toBeUndefined();
    expect(undone.projection.board.some(player => player.name === "Puka Nacua")).toBe(true);
  });
});
