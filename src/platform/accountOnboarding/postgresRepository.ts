import type { PostgresQueryClient, PostgresQueryResult } from "../postgresPlatformStore.js";
import type {
  AccountOnboardingIntent,
  AccountOnboardingProvider,
  AccountOnboardingRecord,
  AccountOnboardingRepository,
  SetAccountOnboardingIntentInput,
  SetAccountOnboardingProvidersInput,
} from "./contracts.js";

interface AccountOnboardingRow {
  account_id: string;
  intent: unknown;
  providers_json: unknown;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const selectedColumns = `account_id, intent, providers_json, completed_at, created_at, updated_at`;
const isIntent = (value: unknown): value is AccountOnboardingIntent =>
  value === "practice" || value === "live_draft";
const isProvider = (value: unknown): value is AccountOnboardingProvider =>
  value === "espn" || value === "sleeper" || value === "yahoo"
  || value === "other" || value === "none";

const date = (value: Date | string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid account onboarding timestamp.");
  return parsed;
};

const rowRecord = (row: AccountOnboardingRow): AccountOnboardingRecord => {
  if (row.intent !== null && !isIntent(row.intent)) {
    throw new Error("Invalid account onboarding intent.");
  }
  const providerValues = row.providers_json;
  if (providerValues !== null && !Array.isArray(providerValues)) {
    throw new Error("Invalid account onboarding providers.");
  }
  const parsedProviders = providerValues === null
    ? null
    : providerValues.map(value => {
      if (!isProvider(value)) throw new Error("Invalid account onboarding providers.");
      return value;
    });
  return {
    accountId: row.account_id,
    intent: row.intent,
    providers: parsedProviders,
    completedAt: row.completed_at === null ? null : date(row.completed_at),
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at),
  };
};

const firstRecord = (result: PostgresQueryResult<AccountOnboardingRow>): AccountOnboardingRecord | null => {
  const row = result.rows[0];
  return row === undefined ? null : rowRecord(row);
};

export class PostgresAccountOnboardingRepository implements AccountOnboardingRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async findByAccountId(accountId: string): Promise<AccountOnboardingRecord | null> {
    return firstRecord(await this.client.query<AccountOnboardingRow>(
      `SELECT ${selectedColumns} FROM account_onboarding_profiles WHERE account_id = $1`,
      [accountId],
    ));
  }

  async setIntent(input: SetAccountOnboardingIntentInput): Promise<AccountOnboardingRecord> {
    const saved = firstRecord(await this.client.query<AccountOnboardingRow>(
      `INSERT INTO account_onboarding_profiles (account_id, intent, created_at, updated_at)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (account_id) DO UPDATE
       SET intent = EXCLUDED.intent, updated_at = EXCLUDED.updated_at
       WHERE account_onboarding_profiles.completed_at IS NULL
       RETURNING ${selectedColumns}`,
      [input.accountId, input.intent, input.now],
    ));
    if (saved !== null) return saved;
    const completed = await this.findByAccountId(input.accountId);
    if (completed === null) throw new Error("Account onboarding intent was not saved.");
    return completed;
  }

  async setProviders(input: SetAccountOnboardingProvidersInput): Promise<AccountOnboardingRecord | null> {
    const saved = firstRecord(await this.client.query<AccountOnboardingRow>(
      `UPDATE account_onboarding_profiles
       SET providers_json = $2::jsonb, updated_at = $3
       WHERE account_id = $1 AND intent IS NOT NULL AND completed_at IS NULL
       RETURNING ${selectedColumns}`,
      [input.accountId, JSON.stringify(input.providers), input.now],
    ));
    return saved ?? await this.findByAccountId(input.accountId);
  }

  async complete(input: { readonly accountId: string; readonly now: Date }): Promise<AccountOnboardingRecord | null> {
    const saved = firstRecord(await this.client.query<AccountOnboardingRow>(
      `UPDATE account_onboarding_profiles
       SET completed_at = $2, updated_at = $2
       WHERE account_id = $1 AND intent IS NOT NULL AND providers_json IS NOT NULL
         AND completed_at IS NULL
       RETURNING ${selectedColumns}`,
      [input.accountId, input.now],
    ));
    return saved ?? await this.findByAccountId(input.accountId);
  }
}
