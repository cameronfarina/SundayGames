import { describe, expect, it } from "vitest";
import type { LiveDraftRoomSetupPostgresRow } from "../src/platform/liveDraftRoomSetups.js";
import { setupFromRow } from "../src/platform/liveDraftRoomSetups/rowCodec.js";

const rowFor = (
  playerCatalogJson: unknown,
  initialRostersJson: unknown,
  updatedAt: Date | string = "2026-08-10T12:00:00.000Z",
): LiveDraftRoomSetupPostgresRow => ({
  league_season_id: "season_2026",
  source_version: "mockd-2026-v1",
  player_catalog_json: playerCatalogJson,
  initial_rosters_json: initialRostersJson,
  content_hash: "content-hash",
  updated_at: updatedAt,
});

describe("live draft room setup row decoding", () => {
  it("decodes every catalog field and accepted position", () => {
    const positions = ["QB", "RB", "WR", "TE", "K", "DST"];
    const players = positions.map((position, index) => ({
      name: `Player ${String(index + 1)}`,
      position,
      expectedPrice: 20 + index,
      marketPrice: 18 + index,
      teamAbbreviation: "NFL",
      byeWeek: 6,
      week1Projection: 10,
      weeks1To4Projection: 40,
      seasonProjection: 200,
      seasonProjectionAdjustmentFactor: 1.1,
      seasonProjectionScoring: {
        rushingYards: 0.1,
        rushingTouchdown: 6,
        receivingYards: 0.1,
        receivingTouchdown: 6,
        reception: 0.5,
      },
    }));

    const decoded = setupFromRow(rowFor(players, [], new Date("2026-08-10T12:00:00.000Z")));

    expect(decoded.playerCatalog).toHaveLength(6);
    expect(decoded.playerCatalog[0]).toMatchObject({
      position: "QB",
      marketPrice: 18,
      seasonProjectionAdjustmentFactor: 1.1,
      seasonProjectionScoring: { reception: 0.5 },
    });
    expect(decoded.updatedAt).toEqual(new Date("2026-08-10T12:00:00.000Z"));
  });

  it("decodes optional keeper fields and accepted sources", () => {
    const decoded = setupFromRow(rowFor([], [
      { teamId: "team-1", playerName: "Keeper", position: "RB", price: 5, source: "keeper" },
      {
        teamId: "team-2",
        playerId: "player-2",
        playerName: "Imported",
        position: "WR",
        price: 10,
        keeperRound: 3,
        expectedPrice: 20,
        source: "imported",
      },
      { teamId: "team-3", playerName: "Legacy", position: "TE", price: 1, source: null },
    ]));

    expect(decoded.initialRosters).toEqual([
      { teamId: "team-1", playerName: "Keeper", position: "RB", price: 5, source: "keeper" },
      {
        teamId: "team-2",
        playerId: "player-2",
        playerName: "Imported",
        position: "WR",
        price: 10,
        keeperRound: 3,
        expectedPrice: 20,
        source: "imported",
      },
      { teamId: "team-3", playerName: "Legacy", position: "TE", price: 1, source: undefined },
    ]);
  });

  it.each([
    ["catalog object", {}, [], "playerCatalog"],
    ["catalog record", [null], [], "playerCatalog[0]"],
    ["catalog number", [{ name: "Player", position: "RB", expectedPrice: Infinity }], [], "playerCatalog[0].expectedPrice"],
    ["catalog position", [{ name: "Player", position: "FLEX", expectedPrice: 1 }], [], "playerCatalog[0].position"],
    ["roster object", [], {}, "initialRosters"],
    ["roster source", [], [{ teamId: "team", playerName: "Player", position: "RB", price: 1, source: "sale" }], "initialRosters[0].source"],
  ])("rejects invalid %s", (_label, catalog, rosters, path) => {
    expect(() => setupFromRow(rowFor(catalog, rosters))).toThrow(`field ${path} is invalid`);
  });

  it("rejects an invalid stored timestamp", () => {
    expect(() => setupFromRow(rowFor([], [], "not-a-date"))).toThrow("field updatedAt is invalid");
  });
});
