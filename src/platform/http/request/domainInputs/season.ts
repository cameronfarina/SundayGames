import type { LeagueSeason } from "../../../leagueSeason.js";
import type { PlatformLeagueMembership } from "../../../platformApp.js";
import {
  arrayValue,
  isUnknownRecord,
  optionalString,
  stringValue,
  unknownRecord,
} from "../values.js";

export const isLeagueSeason = (value: unknown): value is LeagueSeason => {
  const record = unknownRecord(value);
  return record !== null
    && typeof record.id === "string"
    && typeof record.leagueId === "string"
    && typeof record.seasonYear === "number"
    && isUnknownRecord(record.league)
    && isUnknownRecord(record.settings)
    && Array.isArray(record.teams);
};

export const platformLeagueMembershipsFrom = (
  value: unknown,
): readonly PlatformLeagueMembership[] => arrayValue(value).flatMap(candidate => {
  const record = unknownRecord(candidate);
  if (record === null) return [];
  const role = record.role;
  if (role !== "owner" && role !== "admin" && role !== "member" && role !== "observer") {
    return [];
  }
  const ownerId = optionalString(record.ownerId);
  const teamId = optionalString(record.teamId);
  const inviteEmail = optionalString(record.inviteEmail);
  return [{
    userId: stringValue(record.userId),
    leagueId: stringValue(record.leagueId),
    role,
    ...(ownerId === undefined ? {} : { ownerId }),
    ...(teamId === undefined ? {} : { teamId }),
    ...(inviteEmail === undefined ? {} : { inviteEmail }),
  }];
});
