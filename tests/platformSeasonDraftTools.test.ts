import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  currentLeagueInitialRostersFor,
  loadCurrentPlayerCatalog,
} from "../src/platform/localDemoFixtures.js";
import { InMemoryLiveDraftRoomSetupRepository } from "../src/platform/liveDraftRoomSetups.js";
import { buildSeasonDraftToolsOptions } from "../src/platform/platformSeasonDraftTools.js";

const now = new Date("2026-08-10T12:00:00.000Z");

describe("season-backed private draft tools", () => {
  it("uses the provisioned player catalog and keeper roster", async () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "published" });
    const repository = new InMemoryLiveDraftRoomSetupRepository();
    const setup = await repository.save({
      seasonId: season.id,
      sourceVersion: "test-current-season",
      playerCatalog: await loadCurrentPlayerCatalog(),
      initialRosters: currentLeagueInitialRostersFor(season),
      updatedAt: now,
    });

    const options = await buildSeasonDraftToolsOptions(season, setup);

    expect(options.projections).toHaveLength(500);
    expect(options.projections?.[0]).toMatchObject({
      name: "Jahmyr Gibbs",
      espnAuctionValue: 57,
      espnRank: 1,
    });
    expect(options.keepers).toContainEqual(expect.objectContaining({
      owner: "Owner11",
      player: "Ashton Jeanty",
      newCost: 50,
    }));
  });

  it("fails closed for a season shape the current engine cannot model", async () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "published" });
    const unsupportedSeason = {
      ...season,
      teams: season.teams.map((team, index) => index === 0
        ? { ...team, ownerDisplayName: "Different owner" }
        : team),
    };
    const repository = new InMemoryLiveDraftRoomSetupRepository();
    const setup = await repository.save({
      seasonId: season.id,
      sourceVersion: "test-unsupported-season",
      playerCatalog: await loadCurrentPlayerCatalog(),
      initialRosters: currentLeagueInitialRostersFor(season),
      updatedAt: now,
    });

    await expect(buildSeasonDraftToolsOptions(unsupportedSeason, setup)).rejects.toThrow(
      "Private draft tools support the configured 14-owner league order only.",
    );
  });
});
