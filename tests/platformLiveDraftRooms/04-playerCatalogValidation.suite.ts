import { describe, expect, it } from "vitest";
import {
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("rejects empty player catalogs", () => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), { playerCatalog: [] })).toThrow(
      new LiveDraftRoomError("player_not_found", "Player catalog must contain at least one player."),
    );
  });

  it("rejects blank player names", () => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [{ name: " \u00a0 ", position: "WR", expectedPrice: 10 }],
    })).toThrow(new LiveDraftRoomError(
      "player_not_found",
      "Player catalog entry 1 must include a non-blank player name.",
    ));
  });

  it("rejects duplicate normalized player names", () => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [
        { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
        { name: "Devon Achane", position: "RB", expectedPrice: 49 },
      ],
    })).toThrow(new LiveDraftRoomError(
      "duplicate_player",
      'Player catalog contains duplicate player "De\'Von Achane".',
    ));
  });

  it("rejects duplicate player identities that differ only by a generational suffix", () => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [
        { name: "James Cook", position: "RB", expectedPrice: 42 },
        { name: "James Cook III", position: "RB", expectedPrice: 41 },
      ],
    })).toThrow(new LiveDraftRoomError(
      "duplicate_player",
      'Player catalog contains duplicate player "James Cook".',
    ));
  });

  it("rejects unsupported player positions", () => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [{
        name: "Taysom Hill",
        position: "FB",
        expectedPrice: 1,
      }],
    })).toThrow(new LiveDraftRoomError(
      "position_limit",
      'Player catalog entry "Taysom Hill" has unsupported position "FB".',
    ));
  });

  it.each([
    { expectedPrice: Number.NaN, label: "NaN" },
    { expectedPrice: Number.POSITIVE_INFINITY, label: "Infinity" },
    { expectedPrice: 1.5, label: "a fractional value" },
    { expectedPrice: 0, label: "$0" },
  ])("rejects $label expected prices", ({ expectedPrice }) => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice }],
    })).toThrow(new LiveDraftRoomError(
      "invalid_sale_price",
      'Player catalog entry "Puka Nacua" must have an expected price of at least $1 in whole dollars.',
    ));
  });

  it.each(["", "lar", "TOOLONG"])(
    "rejects malformed team abbreviation %j",
    teamAbbreviation => {
      expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
        playerCatalog: [{
          name: "Puka Nacua",
          position: "WR",
          expectedPrice: 73,
          teamAbbreviation,
        }],
      })).toThrow(new LiveDraftRoomError(
        "player_not_found",
        'Player catalog entry "Puka Nacua" must use a 2-3 letter uppercase team abbreviation.',
      ));
    },
  );

  it.each([Number.NaN, 0, 1.5, 19])("rejects malformed bye week %s", byeWeek => {
    expect(() => createRoom(new InMemoryLiveDraftRoomRepository(), {
      playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice: 73, byeWeek }],
    })).toThrow(new LiveDraftRoomError(
      "player_not_found",
      'Player catalog entry "Puka Nacua" must use a whole-number bye week from 1 through 18.',
    ));
  });
});
