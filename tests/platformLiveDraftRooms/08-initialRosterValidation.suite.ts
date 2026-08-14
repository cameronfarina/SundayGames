import { describe, expect, it } from "vitest";
import {
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  publishedSeason,
  teamByOwner,
  type LiveDraftRoomPlayerCatalogEntry,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("rejects non-positive and non-whole-dollar initial roster prices", () => {
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Owner11");
    const invalidPlayers = [
      { playerName: "Puka Nacua", price: 0 },
      { playerName: "Xavier Legette", price: 1.5 },
    ];

    for (const player of invalidPlayers) {
      const repository = new InMemoryLiveDraftRoomRepository();
      expect(() =>
        createRoom(repository, {
          season,
          initialRosters: [
            { teamId: camTeam.id, playerName: player.playerName, position: "WR", price: player.price },
          ],
        }),
      ).toThrow(new LiveDraftRoomError(
        "invalid_sale_price",
        `Initial roster price must be a positive whole-dollar amount for ${player.playerName}.`,
      ));
    }
  });

  it("rejects initial rosters that exceed the roster size", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Owner11");
    const playerPositions: LiveDraftRoomPlayerCatalogEntry["position"][] = [
      "QB", "QB", "QB",
      "RB", "RB", "RB", "RB", "RB", "RB",
      "WR", "WR", "WR", "WR",
      "TE",
      "K",
      "DST",
      "WR",
    ];

    expect(() =>
      createRoom(repository, {
        season,
        initialRosters: playerPositions.map((position, index) => ({
          teamId: camTeam.id,
          playerName: `Initial Player ${index + 1}`,
          position,
          price: 1,
        })),
      }),
    ).toThrow(new LiveDraftRoomError("roster_full", "Owner11 has no open roster slots."));
  });

  it("rejects initial rosters that exceed a position maximum", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Owner11");

    expect(() =>
      createRoom(repository, {
        season,
        initialRosters: [
          { teamId: camTeam.id, playerName: "WR One", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Two", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Three", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Four", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Five", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Six", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Seven", position: "WR", price: 1 },
        ],
      }),
    ).toThrow(new LiveDraftRoomError(
      "position_limit",
      "Owner11 cannot roster WR Seven: roster limit is 6 WRs.",
    ));
  });

  it("rejects initial roster players above the team's max bid", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    const season = publishedSeason();
    const camTeam = teamByOwner(season, "Owner11");

    expect(() =>
      createRoom(repository, {
        season,
        initialRosters: [
          { teamId: camTeam.id, playerName: "Puka Nacua", position: "WR", price: 190 },
        ],
      }),
    ).toThrow(new LiveDraftRoomError(
      "max_bid_exceeded",
      "Owner11 cannot roster Puka Nacua for $190: max bid is $185.",
    ));
  });
});
