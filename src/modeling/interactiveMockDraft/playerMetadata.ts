import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { ProjectionRecord } from "../../projections.js";
import type { Player } from "../../types.js";
import type { AuctionEngineConfig, AuctionOwnerState } from "../auctionEngine.js";
import type { LiveDraftOwnerState, LiveDraftState } from "../liveDraft.js";
import { buildProjectionRankings } from "../projectionRankings.js";

export const normalizePlayerSet = (
  players: readonly { name: string }[],
): Set<string> => new Set(players.map(player => normalizePlayerName(player.name)));

export const playerMetadataByName = (
  auctionPlayers: readonly Player[],
  projections: readonly ProjectionRecord[],
): Map<string, Player> => {
  const metadata = new Map(
    auctionPlayers.map(player => [normalizePlayerName(player.name), player]),
  );

  for (const projection of buildProjectionRankings(projections)) {
    if (metadata.has(projection.normalizedName)) continue;
    metadata.set(projection.normalizedName, {
      id: projection.id,
      name: projection.name,
      position: projection.position,
      ...(projection.proTeamId === undefined ? {} : { proTeamId: projection.proTeamId }),
      price: 1,
      week1: projection.weeks[1] ?? 0,
      weeks1To4: projection.weeks1To4,
    });
  }
  return metadata;
};

const playerForAuctionState = (
  player: LiveDraftOwnerState["roster"][number],
  metadataByName: ReadonlyMap<string, Player>,
): Player => {
  const metadata = metadataByName.get(normalizePlayerName(player.name));
  return {
    ...(metadata?.id === undefined ? {} : { id: metadata.id }),
    name: player.name,
    position: player.position,
    ...(metadata?.proTeamId === undefined ? {} : { proTeamId: metadata.proTeamId }),
    price: player.price,
    week1: metadata?.week1 ?? 0,
    weeks1To4: metadata?.weeks1To4 ?? 0,
    ...(metadata?.contextAdjustmentPercent === undefined
      ? {}
      : { contextAdjustmentPercent: metadata.contextAdjustmentPercent }),
    ...(metadata?.contextEvidenceCount === undefined
      ? {}
      : { contextEvidenceCount: metadata.contextEvidenceCount }),
  };
};

export const ownerStatesFromLiveState = (
  liveState: LiveDraftState,
  metadataByName: ReadonlyMap<string, Player>,
  config: AuctionEngineConfig,
): AuctionOwnerState[] => liveState.owners.map(ownerState => {
  const roster = ownerState.roster.map(player => playerForAuctionState(player, metadataByName));
  const spent = roster.reduce((total, player) => total + player.price, 0);
  const rosterSlotsRemaining = config.rosterSize - roster.length;
  const budgetRemaining = config.auctionBudget - spent;

  return {
    owner: ownerState.owner,
    roster,
    spent,
    budgetRemaining,
    rosterSlotsRemaining,
    maxBid: rosterSlotsRemaining <= 0
      ? 0
      : Math.max(
        0,
        budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * config.minimumBid,
      ),
  };
});
