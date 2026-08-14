import { expect, it } from "vitest";
import { canonicalPlayerIdentityKey } from "../../src/data/normalizePlayerName.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";

export const registerPlayerNameResolutionTests = (): void => {
  it("resolves a unique first-name prefix without losing punctuation in the catalog name", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: {
        ...auctionSetup,
        playerCatalog: [
          ...auctionSetup.playerCatalog,
          { name: "Ja'Marr Chase", position: "WR", expectedPrice: 40 },
        ],
        initialRosters: [{
          teamId: "team-1",
          playerId: "jamarr chase",
          playerName: "Ja'Marr Chase",
          position: "WR",
          price: 20,
          source: "keeper",
        }],
      },
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "draft jamar",
      seedPrefix: "player-token-abbreviation",
    });

    expect(result.strategy.warnings).toEqual([]);
    expect(result.targetOutcome).toMatchObject({
      playerName: "Ja'Marr Chase",
      hitCount: 1,
      hitRate: 1,
    });
  });

  it.each([
    { query: "jameson", playerName: "Jameson Williams" },
    { query: "rhamondre", playerName: "Rhamondre Stevenson" },
    { query: "ladd", playerName: "Ladd McConkey" },
  ])("continues resolving the unique first name $query", ({ query, playerName }) => {
    const playerId = canonicalPlayerIdentityKey(playerName);
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: {
        ...auctionSetup,
        playerCatalog: [
          ...auctionSetup.playerCatalog,
          { name: playerName, position: "WR", expectedPrice: 20 },
        ],
        initialRosters: [{
          teamId: "team-1",
          playerId,
          playerName,
          position: "WR",
          price: 10,
          source: "keeper",
        }],
      },
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: `draft ${query}`,
      seedPrefix: `unique-first-name-${query}`,
    });

    expect(result.strategy.warnings).toEqual([]);
    expect(result.targetOutcome).toMatchObject({
      playerId,
      playerName,
      hitCount: 1,
      hitRate: 1,
    });
  });

  it("resolves a unique surname prefix", () => {
    const playerName = "Ladd McConkey";
    const playerId = canonicalPlayerIdentityKey(playerName);
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: {
        ...auctionSetup,
        playerCatalog: [
          ...auctionSetup.playerCatalog,
          { name: playerName, position: "WR", expectedPrice: 20 },
        ],
        initialRosters: [{
          teamId: "team-1",
          playerId,
          playerName,
          position: "WR",
          price: 10,
          source: "keeper",
        }],
      },
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "draft mcconk",
      seedPrefix: "unique-surname-prefix",
    });

    expect(result.strategy.warnings).toEqual([]);
    expect(result.targetOutcome).toMatchObject({
      playerId,
      playerName,
      hitCount: 1,
      hitRate: 1,
    });
  });
};
