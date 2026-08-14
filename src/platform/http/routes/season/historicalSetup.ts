import type { HistoricalOwnerMapping } from "../../../historicalImports.js";
import { HistoricalImportTargetError } from "../../../historicalImports.js";
import type { LeagueSeason } from "../../../leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../../liveDraftRoomSetups.js";
import { liveDraftRoomSetupContentHash } from "../../../liveDraftRoomSetups.js";
import type { PlatformHttpServices } from "../../contracts.js";
import { arrayValue, optionalNumber, optionalString, stringValue, unknownRecord } from "../../request/values.js";

export const historicalOwnerMappingsFrom = (value: unknown): readonly HistoricalOwnerMapping[] =>
  arrayValue(value).map(mappingValue => {
    const mapping = unknownRecord(mappingValue);
    if (mapping === null) throw new HistoricalImportTargetError("Historical owner mappings must be objects.");
    return {
      sourceOwnerOrTeamLabel: stringValue(mapping.sourceOwnerOrTeamLabel),
      teamId: stringValue(mapping.teamId),
    };
  });

export const historicalPlayerMappingsFrom = (
  value: unknown,
): readonly { rowNumber: number; playerId: string }[] => arrayValue(value).flatMap(candidate => {
  const mapping = unknownRecord(candidate);
  const rowNumber = optionalNumber(mapping?.rowNumber);
  const playerId = optionalString(mapping?.playerId);
  if (rowNumber === undefined || !Number.isSafeInteger(rowNumber) || rowNumber < 1 || playerId === undefined) return [];
  return [{ rowNumber, playerId }];
});

export const historicalDraftSetupFor = async (
  season: LeagueSeason,
  services: PlatformHttpServices,
  now: Date,
): Promise<LiveDraftRoomSetup | null> => {
  const storedSetup = await services.liveDraftRoomSetupRepository?.findForSeason(season.id) ?? null;
  if (storedSetup !== null) return storedSetup;
  const fallbackSetup = await services.liveDraftRoomSetupProvider?.(season) ?? null;
  const playerCatalog = fallbackSetup?.playerCatalog ?? await services.currentPlayerCatalogProvider?.() ?? null;
  if (playerCatalog === null) return null;
  const setupInput = {
    seasonId: season.id,
    sourceVersion: `current-catalog-${season.seasonYear}`,
    playerCatalog,
    initialRosters: fallbackSetup?.initialRosters ?? [],
    updatedAt: now,
  };
  return { ...setupInput, contentHash: liveDraftRoomSetupContentHash(setupInput) };
};
