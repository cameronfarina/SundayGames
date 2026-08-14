import type { LeagueSeason } from "../leagueSeason.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { jsonbParameter } from "./databaseValues.js";
import { rosterRuleSetIdFor } from "./identifiers.js";
import { slotsJsonFor } from "./settingsMapping.js";

export const upsertRosterRules = async (
  client: PostgresQueryClient,
  season: LeagueSeason,
  now: Date,
): Promise<void> => {
  await client.query(`
INSERT INTO roster_rule_sets (
  id,
  league_season_id,
  draft_format,
  budget,
  minimum_bid,
  snake_json,
  slots_json,
  position_maximums_json,
  scoring_json,
  created_at,
  updated_at
) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $10)
ON CONFLICT ON CONSTRAINT roster_rule_sets_league_season_key DO UPDATE SET
  draft_format = EXCLUDED.draft_format,
  budget = EXCLUDED.budget,
  minimum_bid = EXCLUDED.minimum_bid,
  snake_json = EXCLUDED.snake_json,
  slots_json = EXCLUDED.slots_json,
  position_maximums_json = EXCLUDED.position_maximums_json,
  scoring_json = EXCLUDED.scoring_json,
  updated_at = EXCLUDED.updated_at;
`.trim(), [
    rosterRuleSetIdFor(season),
    season.id,
    season.settings.draftFormat,
    season.settings.draftFormat === "auction" ? season.settings.auction.budgetDollars : null,
    season.settings.draftFormat === "auction" ? season.settings.auction.minimumBidDollars : null,
    season.settings.draftFormat === "snake" ? jsonbParameter(season.settings.snake) : null,
    jsonbParameter(slotsJsonFor(season.settings.roster)),
    jsonbParameter(season.settings.roster.rosterMaximums),
    jsonbParameter(season.settings.scoring),
    now,
  ]);
};
