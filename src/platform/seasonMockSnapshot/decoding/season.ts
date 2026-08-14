import type {
  ExplicitLeagueSeasonSettings,
  FantasyTeam,
  League,
  LeagueSeason,
  LeagueSeasonDraftSchedule,
  LeagueSeasonSetupStatus,
} from "../../leagueSeason.js";
import { malformedSnapshot } from "../errors.js";
import {
  arrayValue,
  nonEmptyString,
  optionalString,
  optionalStringArray,
  plainRecord,
  positiveInteger,
} from "./primitives.js";
import { settingsValue } from "./seasonSettings.js";

const leagueValue = (value: unknown): League => {
  const record = plainRecord(value);
  const provider = record.provider;
  if (provider !== "mockd" && provider !== "espn" && provider !== "sleeper" && provider !== "yahoo") {
    return malformedSnapshot();
  }
  return {
    id: nonEmptyString(record.id),
    externalLeagueId: nonEmptyString(record.externalLeagueId),
    name: nonEmptyString(record.name),
    provider,
  };
};

const fantasyTeamValue = (value: unknown): FantasyTeam => {
  const record = plainRecord(value);
  const managerDisplayNames = optionalStringArray(record.managerDisplayNames);
  const abbreviation = optionalString(record.abbreviation);
  return {
    id: nonEmptyString(record.id),
    leagueSeasonId: nonEmptyString(record.leagueSeasonId),
    ownerId: nonEmptyString(record.ownerId),
    ownerDisplayName: nonEmptyString(record.ownerDisplayName),
    ...(managerDisplayNames === undefined ? {} : { managerDisplayNames }),
    ...(abbreviation === undefined ? {} : { abbreviation }),
    displayName: nonEmptyString(record.displayName),
    draftOrderPosition: positiveInteger(record.draftOrderPosition),
  };
};

const setupStatusValue = (value: unknown): LeagueSeasonSetupStatus => {
  if (value === "draft" || value === "published" || value === "locked") return value;
  return malformedSnapshot();
};

const draftScheduleValue = (value: unknown): LeagueSeasonDraftSchedule | undefined => {
  if (value === undefined) return undefined;
  const record = plainRecord(value);
  const scheduledAt = optionalString(record.scheduledAt);
  const timezone = optionalString(record.timezone);
  return {
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
    ...(timezone === undefined ? {} : { timezone }),
  };
};

export const seasonValue = (
  value: unknown,
): LeagueSeason<ExplicitLeagueSeasonSettings> => {
  const record = plainRecord(value);
  const draft = draftScheduleValue(record.draft);
  const season: LeagueSeason<ExplicitLeagueSeasonSettings> = {
    id: nonEmptyString(record.id),
    league: leagueValue(record.league),
    leagueId: nonEmptyString(record.leagueId),
    seasonYear: positiveInteger(record.seasonYear),
    teams: arrayValue(record.teams).map(fantasyTeamValue),
    settings: settingsValue(record.settings),
    setupStatus: setupStatusValue(record.setupStatus),
    ...(draft === undefined ? {} : { draft }),
  };
  if (season.league.id !== season.leagueId) return malformedSnapshot();
  if (season.teams.some(team => team.leagueSeasonId !== season.id)) return malformedSnapshot();
  return season;
};
