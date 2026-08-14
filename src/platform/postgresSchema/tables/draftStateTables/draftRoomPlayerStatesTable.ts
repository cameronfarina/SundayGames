import { updatedAtColumn } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const draftRoomPlayerStatesTable: PostgresTableDefinition = {
  name: "draft_room_player_states",
  columns: [
    { name: "id", type: "text" },
    { name: "draft_room_id", type: "text" },
    { name: "player_id", type: "text" },
    { name: "state", type: "text" },
    { name: "fantasy_team_id", type: "text", nullable: true },
    { name: "price", type: "integer", nullable: true },
    { name: "revision", type: "integer" },
    updatedAtColumn,
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    {
      name: "draft_room_player_states_room_player_key",
      columns: ["draft_room_id", "player_id"],
    },
  ],
  checkConstraints: [
    {
      name: "draft_room_player_states_state_check",
      expression: "state IN ('available', 'sold', 'keeper', 'unavailable')",
    },
    {
      name: "draft_room_player_states_price_check",
      expression: "price IS NULL OR price >= 0",
    },
    { name: "draft_room_player_states_revision_check", expression: "revision > 0" },
  ],
  foreignKeys: [
    {
      name: "draft_room_player_states_draft_room_id_fkey",
      columns: ["draft_room_id"],
      references: { table: "draft_rooms", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "draft_room_player_states_player_id_fkey",
      columns: ["player_id"],
      references: { table: "players", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "draft_room_player_states_fantasy_team_id_fkey",
      columns: ["fantasy_team_id"],
      references: { table: "fantasy_teams", columns: ["id"] },
      onDelete: "SET NULL",
    },
  ],
  indexes: [
    {
      name: "draft_room_player_states_room_state_idx",
      columns: ["draft_room_id", "state"],
    },
  ],
};
