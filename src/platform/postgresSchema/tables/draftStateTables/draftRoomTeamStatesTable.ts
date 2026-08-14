import { jsonbArrayDefault, jsonbDefault, updatedAtColumn } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const draftRoomTeamStatesTable: PostgresTableDefinition = {
  name: "draft_room_team_states",
  columns: [
    { name: "id", type: "text" },
    { name: "draft_room_id", type: "text" },
    { name: "fantasy_team_id", type: "text" },
    { name: "spent", type: "integer" },
    { name: "remaining_budget", type: "integer" },
    { name: "max_bid", type: "integer" },
    { name: "roster_slots_remaining", type: "integer" },
    { name: "position_counts_json", type: "jsonb", default: jsonbDefault },
    { name: "roster_json", type: "jsonb", default: jsonbArrayDefault },
    { name: "validity_json", type: "jsonb", default: jsonbDefault },
    { name: "revision", type: "integer" },
    updatedAtColumn,
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    {
      name: "draft_room_team_states_room_team_key",
      columns: ["draft_room_id", "fantasy_team_id"],
    },
  ],
  checkConstraints: [
    {
      name: "draft_room_team_states_non_negative_check",
      expression: "spent >= 0 AND remaining_budget >= 0 AND max_bid >= 0 AND roster_slots_remaining >= 0",
    },
    { name: "draft_room_team_states_revision_check", expression: "revision > 0" },
  ],
  foreignKeys: [
    {
      name: "draft_room_team_states_draft_room_id_fkey",
      columns: ["draft_room_id"],
      references: { table: "draft_rooms", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "draft_room_team_states_fantasy_team_id_fkey",
      columns: ["fantasy_team_id"],
      references: { table: "fantasy_teams", columns: ["id"] },
      onDelete: "CASCADE",
    },
  ],
  indexes: [
    {
      name: "draft_room_team_states_room_revision_idx",
      columns: ["draft_room_id", "revision"],
    },
  ],
};
