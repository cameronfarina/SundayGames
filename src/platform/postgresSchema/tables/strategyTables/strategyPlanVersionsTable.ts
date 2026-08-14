import { createdAtColumn, jsonbArrayDefault, jsonbDefault } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const strategyPlanVersionsTable: PostgresTableDefinition = {
  name: "strategy_plan_versions",
  columns: [
    { name: "id", type: "text" },
    { name: "strategy_plan_id", type: "text" },
    { name: "version_number", type: "integer" },
    { name: "prompt", type: "text" },
    { name: "summary", type: "text" },
    { name: "commands_json", type: "jsonb", default: jsonbArrayDefault },
    { name: "locks_json", type: "jsonb", default: jsonbArrayDefault },
    { name: "targets_json", type: "jsonb", default: jsonbArrayDefault },
    { name: "guardrails_json", type: "jsonb", default: jsonbArrayDefault },
    { name: "context_manifest_json", type: "jsonb", default: jsonbDefault },
    createdAtColumn,
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    { name: "strategy_plan_versions_plan_version_key", columns: ["strategy_plan_id", "version_number"] },
  ],
  checkConstraints: [
    { name: "strategy_plan_versions_version_number_check", expression: "version_number > 0" },
  ],
  foreignKeys: [
    {
      name: "strategy_plan_versions_strategy_plan_id_fkey",
      columns: ["strategy_plan_id"],
      references: { table: "strategy_plans", columns: ["id"] },
      onDelete: "CASCADE",
    },
  ],
};
