import { parseLeagueSetupImport } from "../leagueSetupImport.js";
import type { PlatformSetupApp } from "./app.js";
import type {
  PlatformLeagueSetupImportInput,
  PlatformLeagueSetupImportPreviewBody,
  PlatformSetupHttpResponse,
} from "./contracts.js";
import { existingSeasonFor } from "./seasonAccess.js";
import { setupImportContent } from "./setupImportContent.js";

export const previewLeagueSetupImport = async (
  app: PlatformSetupApp,
  input: PlatformLeagueSetupImportInput,
): Promise<PlatformSetupHttpResponse<PlatformLeagueSetupImportPreviewBody>> => {
  const season = await existingSeasonFor(app, input);
  const parsedImport = parseLeagueSetupImport(
    setupImportContent(input),
    season === null ? {} : { expectedTeamCount: season.settings.expectedTeamCount },
  );

  return { status: 200, body: { import: parsedImport } };
};
