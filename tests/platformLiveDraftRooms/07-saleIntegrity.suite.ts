import { describe, expect, it } from "vitest";
import {
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  now,
  publishedSeason,
  startRoom,
  teamByOwner,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("rejects structured sales when teamId and ownerId point to different teams", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    createRoom(repository, { season });
    startRoom(repository);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        idempotencyKey: "sale:mismatched-team-owner",
        sale: {
          teamId: camTeam.id,
          ownerId: sethTeam.ownerId,
          playerName: "Puka Nacua",
          price: 1,
        },
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new LiveDraftRoomError(
      "team_not_found",
      `Sale team does not match owner "${sethTeam.ownerId}".`,
    ));
  });

  it("rejects duplicate sold players", () => {
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

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 3,
        idempotencyKey: "sale:puka:63",
        sale: "owner12 puka 63",
        now: new Date(now.getTime() + 3_000),
      }),
    ).toThrow(new LiveDraftRoomError("duplicate_player", "Puka Nacua is already unavailable."));
  });

  it("rejects duplicate players in initial rosters", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Owner11");
    const samTeam = teamByOwner(season, "Owner12");

    expect(() =>
      createRoom(repository, {
        season,
        initialRosters: [
          { teamId: camTeam.id, playerName: "Puka Nacua", position: "WR", price: 10 },
          { teamId: samTeam.id, playerName: "Puka Nacua", position: "WR", price: 11 },
        ],
      }),
    ).toThrow(new LiveDraftRoomError("duplicate_player", "Puka Nacua is already unavailable."));
  });

  it("rejects initial roster players for unknown teams", () => {
    const repository = new InMemoryLiveDraftRoomRepository();

    expect(() =>
      createRoom(repository, {
        initialRosters: [
          { teamId: "team_missing", playerName: "Puka Nacua", position: "WR", price: 10 },
        ],
      }),
    ).toThrow(new LiveDraftRoomError("team_not_found", "Unknown team \"team_missing\"."));
  });
});
