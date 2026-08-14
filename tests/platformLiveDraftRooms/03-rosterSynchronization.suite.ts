import { describe, expect, it } from "vitest";
import {
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  now,
  playerCatalog,
  publishedSeason,
  startRoom,
  teamByOwner,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("atomically synchronizes keeper rosters and recalibrated player values into an unopened room", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Owner11");
    const room = createRoom(repository, { season });
    const recalibratedCatalog = playerCatalog.map(player => ({
      ...player,
      expectedPrice: player.name === "Jahmyr Gibbs" ? 88 : player.expectedPrice,
    }));
    const initialRosters: Parameters<
      InMemoryLiveDraftRoomRepository["synchronizeInitialRostersForSeason"]
    >[0]["initialRosters"] = [{
      teamId: camTeam.id,
      playerId: "devon achane",
      playerName: "De'Von Achane",
      position: "RB",
      price: 50,
      expectedPrice: 50,
      source: "keeper",
    }];

    const synchronized = repository.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: commissioner,
      initialRosters,
      playerCatalog: recalibratedCatalog,
      idempotencyKey: "keepers:version-1",
      now: new Date(now.getTime() + 1_000),
    });
    const retried = repository.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: commissioner,
      initialRosters,
      playerCatalog: recalibratedCatalog,
      idempotencyKey: "keepers:version-1",
      now: new Date(now.getTime() + 2_000),
    });

    expect(synchronized).toMatchObject({
      revision: room.revision + 1,
      initialRosters,
      playerCatalog: expect.arrayContaining([
        expect.objectContaining({ name: "Jahmyr Gibbs", expectedPrice: 88 }),
      ]),
      events: [
        { type: "room_created" },
        {
          type: "initial_rosters_synchronized",
          initialRosters,
          playerCatalog: expect.arrayContaining([
            expect.objectContaining({ name: "Jahmyr Gibbs", expectedPrice: 88 }),
          ]),
        },
      ],
    });
    expect(retried).toEqual(synchronized);
    expect(retried?.projection.teams.find(team => team.teamId === camTeam.id)).toMatchObject({
      spent: 50,
      budgetRemaining: 150,
      rosterSlotsRemaining: 15,
      roster: [{ name: "De'Von Achane", price: 50, source: "keeper" }],
    });
    expect(retried?.projection.board.map(player => player.name)).not.toContain("De'Von Achane");
    expect(retried?.projection.board).toContainEqual(expect.objectContaining({
      name: "Jahmyr Gibbs",
      expectedPrice: 88,
    }));

    expect(() => repository.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: commissioner,
      initialRosters,
      playerCatalog,
      idempotencyKey: "keepers:version-1",
      now: new Date(now.getTime() + 3_000),
    })).toThrow(new LiveDraftRoomError(
      "idempotency_conflict",
      "A draft room mutation already exists for this idempotency key with different input.",
    ));

    expect(() => repository.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: commissioner,
      initialRosters: [],
      playerCatalog: [],
      idempotencyKey: "keepers:invalid-catalog",
      now: new Date(now.getTime() + 4_000),
    })).toThrow(new LiveDraftRoomError(
      "player_not_found",
      "Player catalog must contain at least one player.",
    ));
    expect(repository.getRoom(room.roomId)).toEqual(synchronized);
  });

  it("locks keeper roster synchronization after the live draft starts", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    createRoom(repository, { season });
    startRoom(repository);

    expect(() => repository.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: commissioner,
      initialRosters: [],
      playerCatalog,
      idempotencyKey: "keepers:too-late",
      now: new Date(now.getTime() + 2_000),
    })).toThrow(new LiveDraftRoomError(
      "room_already_live",
      "Keepers are locked after the live draft starts.",
    ));
  });
});
