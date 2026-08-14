import type {
  ExplicitLeagueSeasonSettings,
  League,
  LeagueSeason,
  RosterRules,
} from "../leagueSeason.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import {
  jsonObjectFromDb,
  numberFromObject,
  providerFromDb,
  statusFromDb,
} from "./databaseValues.js";
import type { LeagueSeasonRow } from "./rows.js";
import {
  draftScheduleFromDb,
  keeperPolicyFromDb,
  lineupFromDb,
  rosterMaximumsFromDb,
  scoringFromDb,
  snakeSettingsFromDb,
} from "./settingsMapping.js";
import { teamsForSeason } from "./teamReads.js";

const rosterFromRow = (row: LeagueSeasonRow): RosterRules => {
  const slotsJson = jsonObjectFromDb(row.slots_json);
  const lineup = lineupFromDb(slotsJson);
  const fallbackSize = Object.values(lineup).reduce((sum, count) => sum + count, 0);
  return {
    rosterSize: numberFromObject(slotsJson, "rosterSize", fallbackSize),
    lineup,
    lineupSlotCount: numberFromObject(slotsJson, "lineupSlotCount", fallbackSize),
    rosterMaximums: rosterMaximumsFromDb(row.position_maximums_json),
  };
};

const leagueFromRow = (row: LeagueSeasonRow): League => ({
  id: row.league_id,
  externalLeagueId: row.provider_league_id ?? row.league_id,
  name: row.league_name,
  provider: providerFromDb(row.provider),
});

export const seasonFromRow = async (
  client: PostgresQueryClient,
  row: LeagueSeasonRow,
): Promise<LeagueSeason> => {
  const teams = await teamsForSeason(client, row.id);
  const settingsJson = jsonObjectFromDb(row.settings_json);
  const roster = rosterFromRow(row);
  const expectedTeamCount = numberFromObject(settingsJson, "expectedTeamCount", teams.length);
  const scoring = scoringFromDb(row.scoring_json);
  const keeperPolicy = keeperPolicyFromDb(settingsJson);
  const settings: ExplicitLeagueSeasonSettings = row.draft_format === "snake"
    ? {
      expectedTeamCount,
      draftFormat: "snake",
      scoring,
      snake: snakeSettingsFromDb(row.snake_json),
      roster,
      keeperPolicy,
    }
    : {
      expectedTeamCount,
      draftFormat: "auction",
      scoring,
      auction: {
        budgetDollars: row.budget ?? 200,
        minimumBidDollars: row.minimum_bid ?? 1,
      },
      roster,
      keeperPolicy,
    };
  const draft = draftScheduleFromDb(row.settings_json);
  return {
    id: row.id,
    league: leagueFromRow(row),
    leagueId: row.league_id,
    seasonYear: Number(row.season_year),
    teams,
    settings,
    setupStatus: statusFromDb(row.status),
    ...(draft === undefined ? {} : { draft }),
  };
};
