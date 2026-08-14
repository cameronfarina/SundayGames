import {
  applyLeagueMembersScreenshotImportToSeason,
  validateLeagueMembersScreenshotImport,
} from "../leagueMembersScreenshotImport.js";
import type { PlatformSetupApp } from "./app.js";
import type {
  PlatformLeagueMembersScreenshotApplyBody,
  PlatformLeagueMembersScreenshotApplyInput,
  PlatformLeagueSetupImportBlockedBody,
  PlatformSetupHttpResponse,
} from "./contracts.js";
import {
  leagueSetupImportBlockedBody,
  leagueSetupLockedBody,
  screenshotReviewRequiredBody,
  seasonRequiredBody,
} from "./responses.js";
import { existingSeasonFor } from "./seasonAccess.js";

export const applyLeagueMembersScreenshotImport = async (
  app: PlatformSetupApp,
  input: PlatformLeagueMembersScreenshotApplyInput,
): Promise<PlatformSetupHttpResponse<
  PlatformLeagueMembersScreenshotApplyBody | PlatformLeagueSetupImportBlockedBody
>> => {
  const season = await existingSeasonFor(app, input);
  if (season === null) return { status: 400, body: seasonRequiredBody };
  if (input.setupRevision === undefined || input.setupRevision.length === 0) {
    return { status: 400, body: screenshotReviewRequiredBody };
  }
  if (await app.hasLiveDraftRoomForSeason(season.id)) {
    return { status: 409, body: leagueSetupLockedBody };
  }
  const parsedImport = validateLeagueMembersScreenshotImport(input.import, {
    expectedTeamCount: season.settings.expectedTeamCount,
    existingTeams: season.teams,
    requireTeamMappings: true,
  });
  if (parsedImport.status === "blocked") {
    return { status: 400, body: leagueSetupImportBlockedBody(parsedImport) };
  }
  const appliedImport = applyLeagueMembersScreenshotImportToSeason(season, parsedImport);
  const memberships = await app.listLeagueMemberships(season.leagueId);
  const registeredSeason = await app.registerLeagueSeason({
    actorSessionToken: input.actorSessionToken,
    season: appliedImport.season,
    memberships,
    expectedSetupRevision: input.setupRevision,
    membershipWriteMode: "preserve",
    now: input.now,
  });

  return {
    status: 200,
    body: {
      season: registeredSeason,
      import: parsedImport,
      memberships,
      pendingInvites: [],
      invitations: [],
      invitationFailures: [],
    },
  };
};
