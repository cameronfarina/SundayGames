import { migrationStatementStartingWith } from "./schemaStatements.js";

export const accountOnboardingMigrationStatements: readonly string[] = [
  migrationStatementStartingWith("CREATE TABLE account_onboarding_profiles")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  `INSERT INTO account_onboarding_profiles
   (account_id, intent, providers_json, completed_at, created_at, updated_at)
   SELECT id, NULL, NULL, now(), now(), now() FROM accounts
   ON CONFLICT (account_id) DO NOTHING;`,
];

export const accountOnboardingRolloutMigrationStatements: readonly string[] = [
  `DELETE FROM account_onboarding_profiles AS profile
   USING accounts AS account
   WHERE profile.account_id = account.id
     AND profile.intent IS NULL
     AND profile.providers_json IS NULL
     AND profile.completed_at IS NOT NULL
     AND account.created_at >= now() - INTERVAL '5 days'
     AND NOT EXISTS (
       SELECT 1 FROM leagues AS league
       WHERE league.created_by_user_id = account.id
     );`,
];

export const accountOnboardingIntentBothMigrationStatements: readonly string[] = [
  "ALTER TABLE account_onboarding_profiles ADD COLUMN IF NOT EXISTS " +
    "intent_both boolean NOT NULL DEFAULT false;",
  "ALTER TABLE account_onboarding_profiles DROP CONSTRAINT IF EXISTS " +
    "account_onboarding_profiles_intent_both_check;",
  "ALTER TABLE account_onboarding_profiles ADD CONSTRAINT " +
    "account_onboarding_profiles_intent_both_check " +
    "CHECK (NOT intent_both OR (intent IS NOT NULL AND intent = 'live_draft')) NOT VALID;",
  "ALTER TABLE account_onboarding_profiles VALIDATE CONSTRAINT " +
    "account_onboarding_profiles_intent_both_check;",
];
