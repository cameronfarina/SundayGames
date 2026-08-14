import { createPlatformDraftToolsAdapter, type PlatformDraftToolsAdapter } from "../platformDraftToolsAdapter.js";
import { platformSessionTokenForHeaders } from "../platformNodeHttp.js";
import { buildSeasonDraftToolsOptions } from "../platformSeasonDraftTools.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";

export const createDraftToolsAdapter = (
  runtimeHolder: PlatformRuntimeHolder,
  options: CreatePlatformServerOptions,
): PlatformDraftToolsAdapter => createPlatformDraftToolsAdapter({
  authorizeSeason: async (account, seasonId) => {
    const runtime = runtimeHolder.current();
    const season = await runtime.leagueSetupRepository.findLeagueSeason(seasonId);
    if (season === null) return false;
    const membership = await runtime.leagueSetupRepository.findMembership(
      account.id,
      season.leagueId,
    );
    return membership !== null;
  },
  baseSessionDirectory: options.draftToolsSessionDirectory ?? "data/platform-draft-tools",
  importMaxBodyBytes: options.screenshotImportBodyLimitBytes,
  legacyMockBatchEnabled: options.legacyMockBatchEnabled ?? false,
  maxBodyBytes: options.bodyLimitBytes,
  resolveSeasonOptions: async seasonId => {
    const runtime = runtimeHolder.current();
    const season = await runtime.leagueSetupRepository.findLeagueSeason(seasonId);
    if (season === null) return null;
    const setup = await runtime.liveDraftRoomSetupProvider(season);
    return setup === null ? null : buildSeasonDraftToolsOptions(season, setup);
  },
  resolveAccount: request => {
    const sessionToken = platformSessionTokenForHeaders(request.headers);
    return sessionToken === undefined
      ? Promise.resolve(null)
      : runtimeHolder.current().app.findAccountBySessionToken(sessionToken, options.now?.());
  },
});
