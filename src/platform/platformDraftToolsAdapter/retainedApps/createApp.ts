import type { LiveDraftServerApp } from "../../../liveDraftServer.js";
import { DraftToolsUnavailableError } from "../errors.js";
import type { DraftToolsRuntime } from "../runtime.js";
import { scopedSessionDirectory } from "../scope.js";
import { disposeDraftToolsApp } from "../serverLifecycle.js";

export const createScopedDraftToolsApp = async (
  runtime: DraftToolsRuntime,
  accountId: string,
  seasonId: string,
): Promise<LiveDraftServerApp> => {
  let seasonOptions = {};
  if (runtime.options.resolveSeasonOptions !== undefined) {
    const resolvedSeasonOptions = await runtime.options.resolveSeasonOptions(seasonId);
    if (resolvedSeasonOptions === null) throw new DraftToolsUnavailableError();
    seasonOptions = resolvedSeasonOptions;
  }

  const app = await runtime.createLiveDraftServer({
    ...seasonOptions,
    importMaxBodyBytes: runtime.importMaxBodyBytes,
    legacyMockBatchEnabled: runtime.legacyMockBatchEnabled,
    maxBodyBytes: runtime.maxBodyBytes,
    mockBatchResourceManager: runtime.mockBatchResourceManager,
    mockBatchResourceScope: { accountId, seasonId },
    sessionDirectory: scopedSessionDirectory(
      runtime.baseSessionDirectory,
      accountId,
      seasonId,
    ),
  });
  if (!app.server.listening) return app;

  await disposeDraftToolsApp(app);
  throw new Error("Classic draft server must be unbound.");
};
