import type { Owner, Position } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionNominationCandidateDiagnostics, AuctionNominationDiagnostics, AuctionOwnerState } from "./auctionContracts.js";
import { ownerIndex } from "./bidOrdering.js";
import { AuctionEngineConfig, PositionAmounts } from "./configContracts.js";
import { hashDivisor, seasonProjectionForPlayer } from "./constants.js";
import { hashString } from "./deterministic.js";

export const compareAuctionPlayers = (left: Player, right: Player): number =>
  right.price - left.price ||
  seasonProjectionForPlayer(right) - seasonProjectionForPlayer(left) ||
  right.weeks1To4 - left.weeks1To4 ||
  left.name.localeCompare(right.name);

export interface NominationSelection {
  index: number;
  player: Player;
  score: number;
  diagnostics: AuctionNominationDiagnostics;
}

export interface NominationTurn {
  owner: Owner;
  nextCursor: number;
}

export type UnrankedNominationCandidateDiagnostics = Omit<AuctionNominationCandidateDiagnostics, "rank">;

export const nominationDiagnosticCandidateLimit = 3;

export const highestMarketPrice = (players: readonly Player[]): number =>
  players.reduce((highest, player) => Math.max(highest, player.price), 0);

export const highestProjectionTotal = (players: readonly Player[]): number =>
  players.reduce((highest, player) => Math.max(highest, seasonProjectionForPlayer(player)), 0);

export const nextNominationTurn = (
  ownerStates: readonly AuctionOwnerState[],
  config: AuctionEngineConfig,
  nominationCursor: number,
): NominationTurn => {
  if (config.owners.length === 0) throw new Error("Auction config must include at least one owner.");

  for (let offset = 0; offset < config.owners.length; offset += 1) {
    const ownerIndex = (nominationCursor + offset) % config.owners.length;
    const owner = config.owners[ownerIndex];
    if (!owner) continue;

    const ownerState = ownerStates.find(state => state.owner === owner);
    if (ownerState && ownerState.rosterSlotsRemaining > 0) {
      return {
        owner,
        nextCursor: ownerIndex + 1,
      };
    }
  }

  throw new Error("Unable to find an owner with an open roster slot.");
};

export const initialNominationCursorFor = (config: AuctionEngineConfig): number => {
  if (config.owners.length === 0) return 0;
  const roll = hashString(`${config.seed}:nomination-cursor`) / hashDivisor;
  return Math.floor(roll * config.owners.length);
};

export type PositionBooleans = Record<Position, boolean>;

export interface NominationOwnerContext {
  state: AuctionOwnerState;
  canCompleteAfterAdding: PositionBooleans;
  directShortageAfterPick: PositionAmounts;
  needScore: PositionAmounts;
  capacity: PositionAmounts;
}

export interface NominationContext {
  availablePositionCounts: PositionAmounts;
  ownerContexts: NominationOwnerContext[];
  ownerContextByOwner: ReadonlyMap<Owner, NominationOwnerContext>;
  ownersNeedingPosition: PositionAmounts;
}
