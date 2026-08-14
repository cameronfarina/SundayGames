import { timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const leaguesTable: PostgresTableDefinition = {
  name: "leagues",
  columns: [
    { name: "id", type: "text" },
    { name: "name", type: "text" },
    { name: "sport", type: "text", default: "'football'" },
    { name: "provider", type: "text", nullable: true },
    { name: "provider_league_id", type: "text", nullable: true },
    { name: "created_by_user_id", type: "text" },
    { name: "archived_at", type: "timestamptz", nullable: true },
    { name: "archived_by_user_id", type: "text", nullable: true },
    ...timestamps,
  ],
  primaryKey: ["id"],
  checkConstraints: [
    { name: "leagues_name_not_blank", expression: "length(trim(name)) > 0" },
    { name: "leagues_sport_check", expression: "sport IN ('football')" },
  ],
  foreignKeys: [
    {
      name: "leagues_created_by_user_id_fkey",
      columns: ["created_by_user_id"],
      references: { table: "accounts", columns: ["id"] },
      onDelete: "RESTRICT",
    },
    {
      name: "leagues_archived_by_user_id_fkey",
      columns: ["archived_by_user_id"],
      references: { table: "accounts", columns: ["id"] },
      onDelete: "RESTRICT",
    },
  ],
  indexes: [
    { name: "leagues_created_by_user_id_idx", columns: ["created_by_user_id"] },
    {
      name: "leagues_active_created_by_user_id_idx",
      columns: ["created_by_user_id"],
      where: "archived_at IS NULL",
    },
  ],
};
