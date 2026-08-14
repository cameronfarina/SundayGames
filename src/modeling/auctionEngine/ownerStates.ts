import type { Owner } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionOwnerState } from "./auctionContracts.js";
import { AuctionEngineConfig, InitialRostersByOwner, PositionAmounts } from "./configContracts.js";
import { emptyPositionAmounts } from "./constants.js";
import { defaultAuctionEngineConfig } from "./defaultConfig.js";

export const countPositions = (players: readonly Player[]): PositionAmounts => {
  const counts = emptyPositionAmounts();

  for (const player of players) {
    counts[player.position] += 1;
  }

  return counts;
};

export const maxBidFor = (
  budgetRemaining: number,
  rosterSlotsRemaining: number,
  minimumBid: number,
): number => {
  if (rosterSlotsRemaining <= 0) return 0;
  return Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * minimumBid);
};

export const ownerStateFromRoster = (
  owner: Owner,
  roster: readonly Player[],
  config: AuctionEngineConfig,
): AuctionOwnerState => {
  const spent = roster.reduce((total, player) => total + player.price, 0);
  const rosterSlotsRemaining = config.rosterSize - roster.length;
  const budgetRemaining = config.auctionBudget - spent;

  return {
    owner,
    roster: [...roster],
    spent,
    budgetRemaining,
    rosterSlotsRemaining,
    maxBid: maxBidFor(budgetRemaining, rosterSlotsRemaining, config.minimumBid),
  };
};

export const createAuctionOwnerStates = ({
  config = defaultAuctionEngineConfig,
  initialRostersByOwner = {},
}: {
  config?: AuctionEngineConfig;
  initialRostersByOwner?: InitialRostersByOwner;
}): AuctionOwnerState[] =>
  config.owners.map(owner => {
    const initialRoster = initialRostersByOwner[owner] ?? [];
    if (initialRoster.length > config.rosterSize) {
      throw new Error(`${owner} has more initial players than roster slots.`);
    }

    return ownerStateFromRoster(owner, initialRoster, config);
  });
