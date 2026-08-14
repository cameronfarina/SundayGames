import { timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const leagueMembershipsTable: PostgresTableDefinition = {
  name: "league_memberships",
  columns: [
    { name: "id", type: "text" },
    { name: "league_id", type: "text" },
    { name: "user_id", type: "text" },
    { name: "role", type: "text" },
    { name: "status", type: "text", default: "'active'" },
    ...timestamps,
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    { name: "league_memberships_league_user_key", columns: ["league_id", "user_id"] },
  ],
  checkConstraints: [
    {
      name: "league_memberships_role_check",
      expression: "role IN ('owner', 'admin', 'member', 'observer')",
    },
    {
      name: "league_memberships_status_check",
      expression: "status IN ('invited', 'active', 'disabled')",
    },
  ],
  foreignKeys: [
    {
      name: "league_memberships_league_id_fkey",
      columns: ["league_id"],
      references: { table: "leagues", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "league_memberships_user_id_fkey",
      columns: ["user_id"],
      references: { table: "accounts", columns: ["id"] },
      onDelete: "CASCADE",
    },
  ],
  indexes: [
    { name: "league_memberships_user_status_idx", columns: ["user_id", "status"] },
  ],
};
