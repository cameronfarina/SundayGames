import {
  applyLeagueSetupImportToSeason,
  parseLeagueSetupImport,
  unclaimedTeamsForRecords,
} from "../leagueSetupImport.js";
import { leagueSetupTeamAssignments } from "../leagueSetupImport/teamAssignmentPreview.js";
import type { PlatformSetupApp } from "./app.js";
import type {
  PlatformLeagueSetupImportApplyBody,
  PlatformLeagueSetupImportBlockedBody,
  PlatformLeagueSetupImportInput,
  PlatformSetupHttpResponse,
} from "./contracts.js";
import { deliverSetupInvitations } from "./invitationDelivery.js";
import { reconcileSetupMemberships } from "./membershipReconciliation.js";
import {
  leagueSetupDeletesTeamsBody,
  leagueSetupImportBlockedBody,
  leagueSetupLockedBody,
  seasonRequiredBody,
} from "./responses.js";
import { existingSeasonFor } from "./seasonAccess.js";
import { setupImportContent } from "./setupImportContent.js";

export const applyLeagueSetupImport = async (
  app: PlatformSetupApp,
  input: PlatformLeagueSetupImportInput,
): Promise<PlatformSetupHttpResponse<
  PlatformLeagueSetupImportApplyBody | PlatformLeagueSetupImportBlockedBody
>> => {
  const season = await existingSeasonFor(app, input);
  if (season === null) return { status: 400, body: seasonRequiredBody };
  if (await app.hasLiveDraftRoomForSeason(season.id)) {
    return { status: 409, body: leagueSetupLockedBody };
  }
  const parsedImport = parseLeagueSetupImport(setupImportContent(input), {
    expectedTeamCount: season.settings.expectedTeamCount,
  });
  if (parsedImport.status === "blocked") {
    return { status: 400, body: leagueSetupImportBlockedBody(parsedImport) };
  }
  const deletedTeams = unclaimedTeamsForRecords(season, parsedImport.records);
  if (deletedTeams.length > 0) {
    return { status: 409, body: leagueSetupDeletesTeamsBody(deletedTeams) };
  }
  const teamAssignments = leagueSetupTeamAssignments(season, parsedImport.records);
  const appliedImport = applyLeagueSetupImportToSeason(season, parsedImport.records);
  const reconciliation = await reconcileSetupMemberships(
    app,
    input,
    season,
    appliedImport.memberships,
  );
  const registeredSeason = await app.registerLeagueSeason({
    actorSessionToken: input.actorSessionToken,
    season: appliedImport.season,
    memberships: reconciliation.memberships,
    now: input.now,
  });
  const delivery = await deliverSetupInvitations({
    ...(input.invitationRepository === undefined
      ? {}
      : { repository: input.invitationRepository }),
    actorAccountId: reconciliation.actorAccountId,
    seasonId: registeredSeason.id,
    pendingInvites: reconciliation.pendingInvites,
    now: input.now,
  });

  return {
    status: delivery.invitationFailures.length === 0 ? 200 : 207,
    body: {
      season: registeredSeason,
      import: parsedImport,
      teamAssignments,
      memberships: reconciliation.memberships,
      pendingInvites: reconciliation.pendingInvites,
      invitations: delivery.invitations,
      invitationFailures: delivery.invitationFailures,
    },
  };
};
