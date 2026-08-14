import {
  suggestLeagueMembersScreenshotTeamMappings,
  validateLeagueMembersScreenshotImport,
} from "../leagueMembersScreenshotImport.js";
import { leagueSeasonSetupRevision } from "../leagueSetup.js";
import type { PlatformSetupApp } from "./app.js";
import type {
  PlatformLeagueMembersScreenshotAnalyzeInput,
  PlatformLeagueMembersScreenshotPreviewBody,
  PlatformSetupHttpResponse,
} from "./contracts.js";
import { seasonRequiredBody } from "./responses.js";
import { existingSeasonFor } from "./seasonAccess.js";

export const analyzeLeagueMembersScreenshot = async (
  app: PlatformSetupApp,
  input: PlatformLeagueMembersScreenshotAnalyzeInput,
): Promise<PlatformSetupHttpResponse<PlatformLeagueMembersScreenshotPreviewBody>> => {
  const season = await existingSeasonFor(app, input);
  if (season === null) return { status: 400, body: seasonRequiredBody };
  const extraction = suggestLeagueMembersScreenshotTeamMappings(
    await input.analyzer.analyze(input.image),
    season,
  );
  const parsedImport = validateLeagueMembersScreenshotImport(extraction, {
    expectedTeamCount: season.settings.expectedTeamCount,
    existingTeams: season.teams,
    requireTeamMappings: true,
  });

  return {
    status: 200,
    body: {
      setupRevision: leagueSeasonSetupRevision(season),
      extraction,
      import: parsedImport,
      availableTeamProfiles: season.teams.map(team => ({
        teamId: team.id,
        ownerDisplayName: team.ownerDisplayName,
        teamDisplayName: team.displayName,
      })),
    },
  };
};
