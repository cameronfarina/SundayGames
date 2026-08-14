import type {
  FantasyTeam,
  League,
  LeagueProvider,
  LeagueSeason,
  LeagueSeasonDraftSchedule,
  LeagueSeasonSetupStatus,
} from "../../leagueSeason.js";
import { normalizeLeagueSeasonSettings } from "../../leagueSeason.js";
import type {
  LeagueCreationRecord,
  PlatformLeagueMembership,
} from "../../leagueSetup.js";
import { leagueSettingsValue } from "./leagueSettings.js";
import { optionalString, roleValue } from "./leaguePrimitives.js";
import {
  arrayValue,
  dateValue,
  integerValue,
  invalidSnapshot,
  optionalValue,
  recordValue,
  stringArrayValue,
  stringValue,
} from "./primitives.js";

const providerValue = (value: unknown, path: string): LeagueProvider => {
  if (value === "mockd" || value === "espn" || value === "sleeper" || value === "yahoo") {
    return value;
  }
  return invalidSnapshot(path);
};

const leagueValue = (value: unknown, path: string): League => {
  const record = recordValue(value, path);
  return {
    id: stringValue(record.id, `${path}.id`),
    externalLeagueId: stringValue(record.externalLeagueId, `${path}.externalLeagueId`),
    name: stringValue(record.name, `${path}.name`),
    provider: providerValue(record.provider, `${path}.provider`),
  };
};

const teamValue = (value: unknown, path: string): FantasyTeam => {
  const record = recordValue(value, path);
  const managerDisplayNames = optionalValue(
    record.managerDisplayNames,
    `${path}.managerDisplayNames`,
    stringArrayValue,
  );
  const abbreviation = optionalString(record.abbreviation, `${path}.abbreviation`);
  return {
    id: stringValue(record.id, `${path}.id`),
    leagueSeasonId: stringValue(record.leagueSeasonId, `${path}.leagueSeasonId`),
    ownerId: stringValue(record.ownerId, `${path}.ownerId`),
    ownerDisplayName: stringValue(record.ownerDisplayName, `${path}.ownerDisplayName`),
    ...(managerDisplayNames === undefined ? {} : { managerDisplayNames }),
    ...(abbreviation === undefined ? {} : { abbreviation }),
    displayName: stringValue(record.displayName, `${path}.displayName`),
    draftOrderPosition: integerValue(record.draftOrderPosition, `${path}.draftOrderPosition`),
  };
};

const setupStatusValue = (value: unknown, path: string): LeagueSeasonSetupStatus => {
  if (value === "draft" || value === "published" || value === "locked") return value;
  return invalidSnapshot(path);
};

const scheduleValue = (value: unknown, path: string): LeagueSeasonDraftSchedule => {
  const record = recordValue(value, path);
  const scheduledAt = optionalString(record.scheduledAt, `${path}.scheduledAt`);
  const timezone = optionalString(record.timezone, `${path}.timezone`);
  return {
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
    ...(timezone === undefined ? {} : { timezone }),
  };
};

export const leagueSeasonValue = (value: unknown, path: string): LeagueSeason => {
  const record = recordValue(value, path);
  const draft = optionalValue(record.draft, `${path}.draft`, scheduleValue);
  return {
    id: stringValue(record.id, `${path}.id`),
    league: leagueValue(record.league, `${path}.league`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    seasonYear: integerValue(record.seasonYear, `${path}.seasonYear`),
    teams: arrayValue(record.teams, `${path}.teams`, teamValue),
    settings: normalizeLeagueSeasonSettings(leagueSettingsValue(record.settings, `${path}.settings`)),
    setupStatus: setupStatusValue(record.setupStatus, `${path}.setupStatus`),
    ...(draft === undefined ? {} : { draft }),
  };
};

export const leagueCreationRecordValue = (
  value: unknown,
  path: string,
): LeagueCreationRecord => {
  const record = recordValue(value, path);
  const archivedAt = optionalValue(record.archivedAt, `${path}.archivedAt`, dateValue);
  const archivedByUserId = optionalString(record.archivedByUserId, `${path}.archivedByUserId`);
  return {
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    createdByUserId: stringValue(record.createdByUserId, `${path}.createdByUserId`),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    ...(archivedAt === undefined ? {} : { archivedAt }),
    ...(archivedByUserId === undefined ? {} : { archivedByUserId }),
  };
};

export const membershipValue = (value: unknown, path: string): PlatformLeagueMembership => {
  const record = recordValue(value, path);
  const ownerId = optionalString(record.ownerId, `${path}.ownerId`);
  const teamId = optionalString(record.teamId, `${path}.teamId`);
  const inviteEmail = optionalString(record.inviteEmail, `${path}.inviteEmail`);
  return {
    userId: stringValue(record.userId, `${path}.userId`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    role: roleValue(record.role, `${path}.role`),
    ...(ownerId === undefined ? {} : { ownerId }),
    ...(teamId === undefined ? {} : { teamId }),
    ...(inviteEmail === undefined ? {} : { inviteEmail }),
  };
};
