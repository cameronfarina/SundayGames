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
  type LeagueSeason,
  type LiveDraftRoomPlayerCatalogEntry,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("rejects sales for players already on initial rosters", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const camTeam = teamByOwner(publishedSeason(), "Owner11");
    createRoom(repository, {
      initialRosters: [
        { teamId: camTeam.id, playerName: "De'Von Achane", position: "RB", price: 50 },
      ],
    });
    startRoom(repository);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        idempotencyKey: "sale:achane:51",
        sale: "owner12 achane 51",
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new LiveDraftRoomError("duplicate_player", "De'Von Achane is already unavailable."));
  });

  it("rejects position maximum overages with user-facing copy", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const camTeam = teamByOwner(publishedSeason(), "Owner11");
    createRoom(repository, {
      initialRosters: [
        { teamId: camTeam.id, playerName: "WR One", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "WR Two", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "WR Three", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "WR Four", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "WR Five", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "WR Six", position: "WR", price: 1 },
      ],
    });
    startRoom(repository);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        idempotencyKey: "sale:legette:2",
        sale: "owner11 legette 2",
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new LiveDraftRoomError(
      "position_limit",
      "Owner11 cannot buy Xavier Legette: roster limit is 6 WRs.",
    ));
  });

  it("uses hybrid slot eligibility and excludes IR from live draft capacity", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const baseSeason = publishedSeason();
    const hybridSeason: LeagueSeason = {
      ...baseSeason,
      settings: {
        ...baseSeason.settings,
        roster: {
          rosterSize: 7,
          lineup: { QB: 1, OP: 1, RB_WR: 1, WR_TE: 1, FLEX: 1, IR: 2 },
          lineupSlotCount: 7,
          rosterMaximums: { QB: 7, RB: 7, WR: 7, TE: 7, K: 7, DST: 7 },
        },
      },
    };
    const camTeam = teamByOwner(hybridSeason, "Owner11");
    const hybridCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
      { name: "QB One", position: "QB", expectedPrice: 10 },
      { name: "QB Two", position: "QB", expectedPrice: 9 },
      { name: "QB Three", position: "QB", expectedPrice: 8 },
      { name: "RB One", position: "RB", expectedPrice: 7 },
      { name: "WR One", position: "WR", expectedPrice: 6 },
      { name: "TE One", position: "TE", expectedPrice: 5 },
    ];
    const room = createRoom(repository, {
      season: hybridSeason,
      playerCatalog: hybridCatalog,
      initialRosters: [
        { teamId: camTeam.id, playerName: "QB One", position: "QB", price: 1 },
        { teamId: camTeam.id, playerName: "QB Two", position: "QB", price: 1 },
        { teamId: camTeam.id, playerName: "RB One", position: "RB", price: 1 },
        { teamId: camTeam.id, playerName: "WR One", position: "WR", price: 1 },
        { teamId: camTeam.id, playerName: "TE One", position: "TE", price: 1 },
      ],
    });
    const owner11 = room.projection.teams.find(team => team.teamId === camTeam.id);

    expect(owner11?.rosterSlotsRemaining).toBe(0);
    expect(owner11?.slots.map(slot => slot.slot)).toEqual(["QB", "OP", "RB_WR", "WR_TE", "FLEX"]);
    expect(owner11?.slots.every(slot => slot.player !== undefined)).toBe(true);

    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      roomId: "room_too_many_qbs",
      season: hybridSeason,
      playerCatalog: hybridCatalog,
      initialRosters: [
        { teamId: camTeam.id, playerName: "QB One", position: "QB", price: 1 },
        { teamId: camTeam.id, playerName: "QB Two", position: "QB", price: 1 },
        { teamId: camTeam.id, playerName: "QB Three", position: "QB", price: 1 },
      ],
    })).toThrow(new LiveDraftRoomError(
      "position_limit",
      "Owner11 cannot roster QB Three: roster limit is 2 QBs.",
    ));
  });
});
