import { jsonbArrayDefault, timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const leagueSeasonDraftSetupsTable: PostgresTableDefinition = {
  name: "league_season_draft_setups",
  columns: [
    { name: "league_season_id", type: "text" },
    { name: "source_version", type: "text" },
    { name: "player_catalog_json", type: "jsonb" },
    { name: "initial_rosters_json", type: "jsonb", default: jsonbArrayDefault },
    { name: "content_hash", type: "text" },
    ...timestamps,
  ],
  primaryKey: ["league_season_id"],
  checkConstraints: [
    { name: "league_season_draft_setups_catalog_array_check", expression: "jsonb_typeof(player_catalog_json) = 'array'" },
    { name: "league_season_draft_setups_rosters_array_check", expression: "jsonb_typeof(initial_rosters_json) = 'array'" },
  ],
  foreignKeys: [
    {
      name: "league_season_draft_setups_season_id_fkey",
      columns: ["league_season_id"],
      references: { table: "league_seasons", columns: ["id"] },
      onDelete: "CASCADE",
    },
  ],
};
