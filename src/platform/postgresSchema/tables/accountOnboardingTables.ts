import { timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const accountOnboardingTables: readonly PostgresTableDefinition[] = [{
  name: "account_onboarding_profiles",
  columns: [
    { name: "account_id", type: "text" },
    { name: "intent", type: "text", nullable: true },
    { name: "intent_both", type: "boolean", default: "false" },
    { name: "providers_json", type: "jsonb", nullable: true },
    { name: "completed_at", type: "timestamptz", nullable: true },
    ...timestamps,
  ],
  primaryKey: ["account_id"],
  checkConstraints: [
    {
      name: "account_onboarding_profiles_intent_check",
      expression: "intent IS NULL OR intent IN ('practice', 'live_draft')",
    },
    {
      name: "account_onboarding_profiles_intent_both_check",
      expression: "NOT intent_both OR (intent IS NOT NULL AND intent = 'live_draft')",
    },
    {
      name: "account_onboarding_profiles_providers_check",
      expression: "providers_json IS NULL OR jsonb_typeof(providers_json) = 'array'",
    },
  ],
  foreignKeys: [{
    name: "account_onboarding_profiles_account_id_fkey",
    columns: ["account_id"],
    references: { table: "accounts", columns: ["id"] },
    onDelete: "CASCADE",
  }],
}];
