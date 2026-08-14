import type { LeagueSeason } from "../leagueSeason.js";
import { liveDraftRoomSetupContentHash, type LiveDraftRoomSetup } from "../liveDraftRoomSetups.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import type { RuntimeRepositories } from "./internalContracts.js";

export const createLiveDraftRoomSetupProvider = (
  options: CreatePlatformServerOptions,
  repositories: RuntimeRepositories,
): ((season: LeagueSeason) => Promise<LiveDraftRoomSetup | null>) =>
  async season => {
    const storedSetup = await repositories.liveDraftRoomSetupRepository.findForSeason(season.id);
    if (storedSetup !== null) return storedSetup;
    const configuredSetup = await options.liveDraftRoomSetupProvider?.(season) ?? null;
    if (configuredSetup !== null) return configuredSetup;
    if (options.currentPlayerCatalogProvider === undefined) return null;
    const input = {
      seasonId: season.id,
      sourceVersion: `current-catalog-${season.seasonYear}`,
      playerCatalog: await options.currentPlayerCatalogProvider(),
      initialRosters: [],
    };
    return {
      ...input,
      contentHash: liveDraftRoomSetupContentHash(input),
      updatedAt: options.now?.() ?? new Date(),
    };
  };
