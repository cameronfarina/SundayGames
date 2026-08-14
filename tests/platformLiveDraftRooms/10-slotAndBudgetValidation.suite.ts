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
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("rejects a roster when two positions compete for the same hybrid slot", () => {
    const baseSeason = publishedSeason();
    const constrainedSeason: LeagueSeason = {
      ...baseSeason,
      settings: {
        ...baseSeason.settings,
        roster: {
          rosterSize: 2,
          lineup: { OP: 1, RB_WR: 1 },
          lineupSlotCount: 2,
          rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 2, DST: 2 },
        },
      },
    };
    const camTeam = teamByOwner(constrainedSeason, "Owner11");

    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      season: constrainedSeason,
      playerCatalog: [
        { name: "QB One", position: "QB", expectedPrice: 10 },
        { name: "TE One", position: "TE", expectedPrice: 9 },
      ],
      initialRosters: [
        { teamId: camTeam.id, playerName: "QB One", position: "QB", price: 1 },
        { teamId: camTeam.id, playerName: "TE One", position: "TE", price: 1 },
      ],
    })).toThrow(new LiveDraftRoomError(
      "position_limit",
      "Owner11 cannot roster TE One: no open roster slot accepts TE.",
    ));
  });

  it("blocks live rooms for seasons with unknown roster slots", () => {
    const baseSeason = publishedSeason();
    const unsupportedSeason: LeagueSeason = {
      ...baseSeason,
      settings: {
        ...baseSeason.settings,
        roster: {
          ...baseSeason.settings.roster,
          lineup: { QB: 1, MYSTERY: 1 },
        },
      },
    };

    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      season: unsupportedSeason,
    })).toThrow(new LiveDraftRoomError(
      "season_not_ready",
      "Roster slot MYSTERY is unsupported. Review the league roster settings before creating a live draft room.",
    ));
  });

  it("rejects sales above the owner's max bid", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);

    expect(() =>
      repository.logSaleCommand({
        roomId: "room_sunday",
        actor: commissioner,
        expectedRevision: 2,
        idempotencyKey: "sale:puka:190",
        sale: "owner11 puka 190",
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new LiveDraftRoomError(
      "max_bid_exceeded",
      "Owner11 cannot buy Puka Nacua for $190: max bid is $185.",
    ));
  });
});
