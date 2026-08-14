import type { LeagueMembersScreenshotConfidence, LeagueMembersScreenshotImportInput } from "../../../leagueMembersScreenshotImport.js";
import type { PlatformLeagueSetupImportKnownUser } from "../../../platformSetupHttp.js";
import { arrayValue, optionalBoolean, optionalNumber, optionalString, stringArrayValue, unknownRecord } from "../../request/values.js";

export const setupImportKnownUsers = (
  value: unknown,
): readonly PlatformLeagueSetupImportKnownUser[] => arrayValue(value).flatMap(candidate => {
  const record = unknownRecord(candidate);
  const email = optionalString(record?.email);
  if (record === null || email === undefined) return [];
  const userId = optionalString(record.userId);
  const accountId = optionalString(record.accountId);
  return [{
    email,
    ...(userId === undefined ? {} : { userId }),
    ...(accountId === undefined ? {} : { accountId }),
  }];
});

const screenshotConfidence = (value: unknown): LeagueMembersScreenshotConfidence =>
  value === "high" || value === "medium" || value === "low" ? value : "low";

export const leagueMembersScreenshotImportInput = (
  body: Record<string, unknown>,
): LeagueMembersScreenshotImportInput => ({
  leagueName: optionalString(body.leagueName) ?? null,
  externalLeagueId: optionalString(body.externalLeagueId) ?? null,
  teams: arrayValue(body.teams).map(candidate => {
    const team = unknownRecord(candidate) ?? {};
    return {
      draftOrderPosition: optionalNumber(team.draftOrderPosition) ?? 0,
      abbreviation: optionalString(team.abbreviation) ?? "",
      teamDisplayName: optionalString(team.teamDisplayName) ?? "",
      managerDisplayNames: stringArrayValue(team.managerDisplayNames),
      confidence: screenshotConfidence(team.confidence),
      issues: stringArrayValue(team.issues),
      confirmed: optionalBoolean(team.confirmed) ?? false,
      targetTeamId: optionalString(team.targetTeamId) ?? null,
    };
  }),
});
