import type {
  League,
  LeagueSeason,
  LeagueSeasonDraftSchedule,
  LeagueSeasonSettings,
} from "../leagueSeason.js";
import { seasonStatuses } from "./constants.js";
import { settingsAt } from "./parseSettings.js";
import {
  arrayAt,
  enumAt,
  fail,
  integerAt,
  objectAt,
  optionalStringAt,
  stringAt,
  uniqueBy,
} from "./validation.js";

interface ParsedTeam {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  displayName: string;
  draftOrderPosition: number;
}

const teamAt = (value: unknown, index: number): ParsedTeam => {
  const path = `season.teams[${index}]`;
  const record = objectAt(value, path);
  return {
    id: stringAt(record.id, `${path}.id`),
    ownerId: stringAt(record.ownerId, `${path}.ownerId`),
    ownerDisplayName: stringAt(record.ownerDisplayName, `${path}.ownerDisplayName`),
    displayName: stringAt(record.name, `${path}.name`),
    draftOrderPosition: integerAt(record.draftOrderPosition, `${path}.draftOrderPosition`, 1),
  };
};

const draftAt = (value: unknown): LeagueSeasonDraftSchedule | undefined => {
  if (value === undefined) return undefined;
  const record = objectAt(value, "season.draft");
  const scheduledAt = optionalStringAt(record.scheduledAt, "season.draft.scheduledAt");
  if (scheduledAt !== undefined && Number.isNaN(Date.parse(scheduledAt))) {
    fail("season.draft.scheduledAt", "expected an ISO-8601 timestamp.");
  }
  return {
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
    ...(record.timezone === undefined ? {} : { timezone: stringAt(record.timezone, "season.draft.timezone") }),
  };
};

export const seasonAt = (
  value: unknown,
  league: League,
): LeagueSeason<LeagueSeasonSettings> => {
  const record = objectAt(value, "season");
  const id = stringAt(record.id, "season.id");
  const parsedTeams = arrayAt(record.teams, "season.teams").map(teamAt);
  if (parsedTeams.length === 0) fail("season.teams", "expected at least one team.");
  uniqueBy(parsedTeams, team => team.id, "season.teams[].id");
  uniqueBy(parsedTeams, team => team.ownerId, "season.teams[].ownerId");
  uniqueBy(parsedTeams, team => String(team.draftOrderPosition), "season.teams[].draftOrderPosition");
  const draft = draftAt(record.draft);
  return {
    id,
    league,
    leagueId: league.id,
    seasonYear: integerAt(record.year, "season.year", 2000),
    setupStatus: enumAt(record.status, seasonStatuses, "season.status"),
    settings: settingsAt(record.settings, parsedTeams.length),
    teams: parsedTeams.map(team => ({ ...team, leagueSeasonId: id })),
    ...(draft === undefined ? {} : { draft }),
  };
};
