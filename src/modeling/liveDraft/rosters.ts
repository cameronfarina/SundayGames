import { leagueConfig, ownerOrder, type Owner, type Position } from "../../../config/league.js";
import type { Player } from "../../types.js";
import type { InitialRostersByOwner } from "../auctionEngine.js";
import type { LiveDraftOwnerState, LiveDraftRosterPlayer } from "./contracts.js";
import type { LiveDraftPlayerRecord, ResolvedSale } from "./internalTypes.js";
import { emptyPositionCounts, maxBidFor } from "./numbers.js";
import { teamMetadataFor } from "./playerMetadata.js";
import { rosterSlotsFor } from "./rosterSlots.js";

const countPositions = (
  players: readonly LiveDraftRosterPlayer[],
): Record<Position, number> => {
  const counts = emptyPositionCounts();
  for (const player of players) counts[player.position] += 1;
  return counts;
};

const playerForRoster = (
  player: Player,
  source: LiveDraftRosterPlayer["source"],
  expectedPrice = player.price,
): LiveDraftRosterPlayer => ({
  name: player.name,
  position: player.position,
  price: player.price,
  expectedPrice,
  source,
  ...teamMetadataFor(player.proTeamId),
});

export const livePlayerForRoster = (
  record: LiveDraftPlayerRecord,
  price: number,
): LiveDraftRosterPlayer => ({
  name: record.name,
  position: record.position,
  price,
  expectedPrice: record.expectedPrice,
  source: record.source,
  ...(record.teamAbbreviation === undefined ? {} : { teamAbbreviation: record.teamAbbreviation }),
  ...(record.byeWeek === undefined ? {} : { byeWeek: record.byeWeek }),
});

export const rostersFromKeepers = (
  initialRostersByOwner: InitialRostersByOwner,
): Map<Owner, LiveDraftRosterPlayer[]> => new Map(ownerOrder.map(owner => [
  owner,
  [...(initialRostersByOwner[owner] ?? [])].map(player => playerForRoster(player, "keeper")),
]));

export const ownerStateFor = (
  owner: Owner,
  roster: readonly LiveDraftRosterPlayer[],
): LiveDraftOwnerState => {
  const spent = roster.reduce((total, player) => total + player.price, 0);
  const rosterSlotsRemaining = leagueConfig.rosterSize - roster.length;
  const budgetRemaining = leagueConfig.auctionBudget - spent;
  return {
    owner,
    roster: [...roster],
    slots: rosterSlotsFor(roster),
    spent,
    budgetRemaining,
    rosterSlotsRemaining,
    maxBid: maxBidFor(budgetRemaining, rosterSlotsRemaining),
    positionCounts: countPositions(roster),
  };
};

export const buildOwnerStates = (
  rostersByOwner: ReadonlyMap<Owner, readonly LiveDraftRosterPlayer[]>,
): LiveDraftOwnerState[] =>
  ownerOrder.map(owner => ownerStateFor(owner, rostersByOwner.get(owner) ?? []));

export const validateSaleFitsOwner = (
  sale: ResolvedSale,
  ownerState: LiveDraftOwnerState,
): void => {
  if (ownerState.rosterSlotsRemaining <= 0) throw new Error(`${sale.owner} has no open roster slots.`);
  if (sale.parsed.price > ownerState.maxBid) {
    throw new Error(`${sale.owner} can only bid up to $${ownerState.maxBid}.`);
  }
  const maximum = leagueConfig.rosterMaximums[sale.player.position];
  if (ownerState.positionCounts[sale.player.position] >= maximum) {
    throw new Error(`${sale.owner} cannot buy ${sale.player.name}: roster limit is ${maximum} ${sale.player.position}s.`);
  }
};

export const totalKeeperSpend = (
  rostersByOwner: ReadonlyMap<Owner, readonly LiveDraftRosterPlayer[]>,
): number => [...rostersByOwner.values()].reduce(
  (total, roster) => total + roster
    .filter(player => player.source === "keeper")
    .reduce((rosterTotal, player) => rosterTotal + player.price, 0),
  0,
);
