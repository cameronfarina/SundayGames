import { describe, expect, it } from "vitest";
import type { SaveLiveDraftRoomSetupInput } from "../src/platform/liveDraftRoomSetups.js";
import { removeSeasonKeeper } from "../src/platform/seasonKeeperSetup.js";

describe("season keeper setup mutations", () => {
  it("removes only the selected keeper and keeps the version marker idempotent", () => {
    const setup: SaveLiveDraftRoomSetupInput = {
      seasonId: "season-2026",
      sourceVersion: "catalog-2026+keepers-v1",
      playerCatalog: [],
      initialRosters: [
        {
          teamId: "team-1",
          playerId: "devon achane",
          playerName: "De'Von Achane",
          position: "RB",
          price: 50,
          source: "keeper",
        },
        {
          teamId: "team-1",
          playerName: "Puka Nacua",
          position: "WR",
          price: 70,
          source: "imported",
        },
      ],
    };
    const now = new Date("2026-08-14T12:00:00.000Z");

    const result = removeSeasonKeeper(setup, {
      teamId: "team-1",
      playerId: "devon achane",
      now,
    });

    expect(result.sourceVersion).toBe("catalog-2026+keepers-v1");
    expect(result.initialRosters).toEqual([setup.initialRosters[1]]);
    expect(result.updatedAt).toBe(now);
  });
});
