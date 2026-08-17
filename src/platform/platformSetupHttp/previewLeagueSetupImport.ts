import { parseLeagueSetupImport } from "../leagueSetupImport.js";
import { leagueSetupTeamAssignments } from "../leagueSetupImport/teamAssignmentPreview.js";
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
  // Says which team every row takes, so a commissioner can see a rename keep
  // its team instead of finding out when a draft room refuses to open.
  const teamAssignments = season === null
    ? []
    : leagueSetupTeamAssignments(season, parsedImport.records);

  return { status: 200, body: { import: parsedImport, teamAssignments } };
};
