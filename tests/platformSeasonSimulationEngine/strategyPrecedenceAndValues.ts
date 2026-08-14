import { expect, it } from "vitest";
import { canonicalPlayerIdentityKey } from "../../src/data/normalizePlayerName.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";

export const registerStrategyPrecedenceAndValueTests = (): void => {
  it("keeps a saved target authoritative when additional strategy names the same player", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-2",
      runCount: 1,
      targetConstraints: [{ playerName: "Jadarian Price", maxAuctionPrice: 12 }],
      strategyInput: "draft jadarian for no more than $20",
      seedPrefix: "saved-target-precedence",
    });

    expect(result.strategy.targets).toEqual([{
      playerName: "Jadarian Price",
      maxAuctionPrice: 12,
    }]);
    expect(result.targetOutcomes).toEqual([
      expect.objectContaining({ playerName: "Jadarian Price" }),
    ]);
  });

  it("uses personal values when choosing players for the claimed team", () => {
    const playerHumanValues = Object.fromEntries(
      auctionSetup.playerCatalog.map(player => [canonicalPlayerIdentityKey(player.name), 1]),
    );
    playerHumanValues["runner five"] = 20;

    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      playerHumanValues,
      seedPrefix: "personal-value-priority",
    });
    const humanRoster = result.runs[0]?.teams.find(team => team.isUserTeam)?.roster ?? [];

    expect(humanRoster).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "Runner Five" }),
    ]));
  });
};
