import type { LeagueSeason } from "../../../leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../../liveDraftRoomSetups.js";
import { liveDraftRoomSetupContentHash } from "../../../liveDraftRoomSetups.js";
import type { PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { knownError } from "../../responses.js";

export const seasonDraftSetupForKeeperEditing = async (
  season: LeagueSeason,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<{
  setup: LiveDraftRoomSetup;
  expectedContentHash: string | null;
} | PlatformHttpResponse> => {
  if (services.liveDraftRoomSetupRepository === undefined) {
    return knownError(503, "keeper_setup_unavailable", "Keeper setup is unavailable.");
  }
  const stored = await services.liveDraftRoomSetupRepository.findForSeason(season.id);
  if (stored !== null) return { setup: stored, expectedContentHash: stored.contentHash };
  const fallback = await services.liveDraftRoomSetupProvider?.(season) ?? null;
  if (fallback === null) {
    return knownError(503, "player_catalog_unavailable", "The current player catalog is unavailable.");
  }
  const setupInput = {
    seasonId: season.id,
    sourceVersion: `current-catalog-${season.seasonYear}`,
    playerCatalog: fallback.playerCatalog,
    initialRosters: fallback.initialRosters,
    updatedAt: request.now ?? new Date(),
  };
  return {
    setup: { ...setupInput, contentHash: liveDraftRoomSetupContentHash(setupInput) },
    expectedContentHash: null,
  };
};
