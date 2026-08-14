import { describe, expect, it } from "vitest";
import { keepers } from "../../config/keepers.js";
import { leagueConfig, ownerOrder, positions } from "../../config/league.js";
import type { Position } from "../../config/league.js";
import { loadHistoricalAuctionRecords } from "../../src/data/parseHistoricalBoards.js";
import {
  buildAuctionConfig,
  buildAuctionPlayerPool,
  buildInitialRostersFromKeepers,
  buildOwnerAuctionBehaviors,
  buildOwnerDemandMultipliers,
  buildOwnerRosterMaximums,
  simulateAuction,
} from "../../src/modeling/auctionEngine.js";
import { buildBasePrices } from "../../src/modeling/basePricing.js";
import { applyKeeperScenarioToPrices, buildKeeperScenarios } from "../../src/modeling/keeperInflation.js";
import { buildOwnerProfiles } from "../../src/modeling/ownerProfiles.js";
import { loadEspnWeeksOneToFour } from "../../src/projections.js";
import { validateRoster } from "../../src/validateMocks.js";
import { defined, fullMockReplacementBuffer, player, projectionPath } from "./support.js";

describe("auction engine economics", () => {
  it("builds valid full-roster mocks from expected keepers and owner-local budgets", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const profiles = buildOwnerProfiles(historicalRecords);
    const prices = buildBasePrices(projections, historicalRecords);
    const expectedScenario = defined(buildKeeperScenarios(keepers).find(scenario => scenario.key === "expected"), "Expected keeper scenario.");
    const adjustedPrices = applyKeeperScenarioToPrices(prices, expectedScenario, keepers);
    const initialRostersByOwner = buildInitialRostersFromKeepers(
      keepers,
      projections,
      expectedScenario.includedKeeperStatuses,
    );
    const keeperCount = Object.values(initialRostersByOwner)
      .reduce((count, roster) => count + (roster?.length ?? 0), 0);
    const auctionPlayers = buildAuctionPlayerPool({
      pricedPlayers: adjustedPrices.availablePrices,
      projections,
      excludedNames: adjustedPrices.unavailableKeepers.map(keeper => keeper.player),
      targetCount: ownerOrder.length * 16 - keeperCount + fullMockReplacementBuffer,
    });
    const ownerRosterMaximums = buildOwnerRosterMaximums(profiles);
    const result = simulateAuction({
      players: auctionPlayers,
      initialRostersByOwner,
      config: buildAuctionConfig({
        ownerDemandMultipliers: buildOwnerDemandMultipliers(profiles),
        ownerBehaviors: buildOwnerAuctionBehaviors(profiles),
        ownerRosterMaximums,
        seed: "economic-regression",
      }),
    });

    expect(result.picks).toHaveLength(ownerOrder.length * 16 - keeperCount);
    expect(result.picks.every(pick => ownerOrder.includes(pick.nominator))).toBe(true);

    const draftedNames = new Set<string>();
    for (const owner of ownerOrder) {
      const roster = result.rosters[owner];
      expect(roster).toBeDefined();
      if (!roster) throw new Error(`Missing roster for ${owner}.`);

      const validation = validateRoster(roster);
      expect(validation.valid, `${owner}: ${validation.errors.join(", ")}`).toBe(true);
      const counts = positions.reduce<Record<Position, number>>(
        (totals, position) => ({
          ...totals,
          [position]: roster.players.filter(player => player.position === position).length,
        }),
        { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      );
      for (const position of positions) {
        const maximum = ownerRosterMaximums[owner]?.[position] ?? leagueConfig.rosterMaximums[position];
        expect(counts[position], `${owner} ${position} count`).toBeLessThanOrEqual(maximum);
      }
      for (const rosterPlayer of roster.players) draftedNames.add(rosterPlayer.name);
    }

    expect(draftedNames.size).toBe(ownerOrder.length * 16);
  }, 15000);
});
