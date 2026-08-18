import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "./liveDraftRooms.js";
import type { PlayerPriceSnapshotRow } from "./pricingSnapshots.js";

export interface BuildSeasonPlayerValuesInput {
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  leaguePrices?: ReadonlyMap<string, number> | undefined;
  personalValues?: ReadonlyMap<string, number> | undefined;
}

export interface SeasonPlayerValues {
  playerExpectedPrices: Readonly<Record<string, number>>;
  playerHumanValues: Readonly<Record<string, number>>;
}

export interface SnapshotPlayerValues {
  leaguePrices: ReadonlyMap<string, number>;
  personalValues: ReadonlyMap<string, number>;
}

const playerValueEntry = (playerName: string, value: number): readonly [string, number] =>
  [canonicalPlayerIdentityKey(playerName), value];

export const snapshotPlayerValues = (
  rows: readonly PlayerPriceSnapshotRow[] = [],
  fallbackCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [],
): SnapshotPlayerValues => ({
  leaguePrices: new Map([
    ...fallbackCatalog.map(player => playerValueEntry(player.name, player.expectedPrice)),
    ...rows.map(row => playerValueEntry(row.playerName, Math.max(1, Math.round(row.scenarioPrice)))),
  ]),
  personalValues: new Map([
    ...fallbackCatalog.map(player => playerValueEntry(player.name, player.expectedPrice)),
    ...rows.map(row => playerValueEntry(row.playerName, Math.max(1, Math.round(row.personalValue)))),
  ]),
});

// One league price per player, keepers included: what a keeper is worth is what
// anyone else would pay for him, and the owner's bargain is budget, not value.
export const buildSeasonPlayerValues = ({
  playerCatalog,
  leaguePrices = new Map(),
  personalValues = new Map(),
}: BuildSeasonPlayerValuesInput): SeasonPlayerValues => {
  const playerExpectedPrices = Object.fromEntries(playerCatalog.map(player => {
    const playerKey = canonicalPlayerIdentityKey(player.name);
    return [
      playerKey,
      leaguePrices.get(playerKey) ?? player.marketPrice ?? player.expectedPrice,
    ];
  }));
  const playerHumanValues = Object.fromEntries(playerCatalog.map(player => {
    const playerKey = canonicalPlayerIdentityKey(player.name);
    return [
      playerKey,
      personalValues.get(playerKey)
        ?? playerExpectedPrices[playerKey]
        ?? player.expectedPrice,
    ];
  }));

  return { playerExpectedPrices, playerHumanValues };
};
