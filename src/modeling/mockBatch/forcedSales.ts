import { leagueConfig, ownerOrder } from "../../../config/league.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { Player } from "../../types.js";
import type { InitialRostersByOwner } from "../auctionEngine.js";
import type { ForcedAuctionSale } from "./contracts.js";
import type { PreparedScenario } from "./internalContracts.js";
import { countRosterPositions } from "./positionAmounts.js";

const assertForcedSalePrice = (sale: ForcedAuctionSale): void => {
  if (!Number.isInteger(sale.price) || sale.price < 1) {
    throw new Error(`Forced sale for ${sale.player} must use a positive whole-dollar price.`);
  }
};

const maxBidForForcedSale = (roster: readonly Player[], minimumBid: number): number => {
  const spent = roster.reduce((total, player) => total + player.price, 0);
  const rosterSlotsRemaining = leagueConfig.rosterSize - roster.length;
  const budgetRemaining = leagueConfig.auctionBudget - spent;

  if (rosterSlotsRemaining <= 0) return 0;
  return Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * minimumBid);
};

const copyRosters = (preparedScenario: PreparedScenario): InitialRostersByOwner => {
  const rosters: InitialRostersByOwner = {};
  for (const owner of ownerOrder) {
    rosters[owner] = [...(preparedScenario.initialRostersByOwner[owner] ?? [])];
  }
  return rosters;
};

export const applyForcedSales = (
  preparedScenario: PreparedScenario,
  forcedSales: readonly ForcedAuctionSale[],
  minimumBid: number,
): PreparedScenario => {
  if (forcedSales.length === 0) return preparedScenario;

  const initialRostersByOwner = copyRosters(preparedScenario);
  const auctionPlayers = [...preparedScenario.auctionPlayers];
  const forcedNames = new Set<string>();

  for (const sale of forcedSales) {
    assertForcedSalePrice(sale);
    const normalizedName = normalizePlayerName(sale.player);
    if (forcedNames.has(normalizedName)) throw new Error(`Forced sale duplicates ${sale.player}.`);
    forcedNames.add(normalizedName);

    const roster = initialRostersByOwner[sale.owner] ?? [];
    if (roster.some(player => normalizePlayerName(player.name) === normalizedName)) {
      throw new Error(`${sale.player} is already on ${sale.owner}'s roster.`);
    }

    const playerIndex = auctionPlayers.findIndex(
      player => normalizePlayerName(player.name) === normalizedName,
    );
    if (playerIndex < 0) {
      throw new Error(`Forced sale player "${sale.player}" is not available in the auction pool.`);
    }
    const player = auctionPlayers[playerIndex];
    if (!player) throw new Error(`Unable to resolve forced sale player "${sale.player}".`);

    const positionMaximum = leagueConfig.rosterMaximums[player.position];
    if (countRosterPositions(roster)[player.position] >= positionMaximum) {
      throw new Error(
        `${sale.owner} cannot force ${player.name}: roster limit is ${positionMaximum} ${player.position}s.`,
      );
    }
    if (roster.length >= leagueConfig.rosterSize) {
      throw new Error(`${sale.owner} cannot force ${player.name}: roster is already full.`);
    }

    const maxBid = maxBidForForcedSale(roster, minimumBid);
    if (sale.price > maxBid) {
      throw new Error(`${sale.owner} cannot force ${player.name} for $${sale.price}: max bid is $${maxBid}.`);
    }

    auctionPlayers.splice(playerIndex, 1);
    initialRostersByOwner[sale.owner] = [...roster, { ...player, price: sale.price }];
  }

  return {
    ...preparedScenario,
    initialRostersByOwner,
    auctionPlayers,
    inputCounts: { ...preparedScenario.inputCounts, auctionPlayers: auctionPlayers.length },
  };
};
