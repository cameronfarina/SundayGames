export type AccountOnboardingIntent = "practice" | "live_draft" | "both";

export type AccountOnboardingProvider =
  | "espn"
  | "sleeper"
  | "yahoo"
  | "other"
  | "none";

export type AccountOnboardingStage = "intent" | "providers" | "connections" | "complete";

export interface AccountOnboardingRecord {
  readonly accountId: string;
  readonly intent: AccountOnboardingIntent | null;
  readonly intentBoth?: boolean;
  readonly providers: readonly AccountOnboardingProvider[] | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AccountOnboardingSnapshot {
  readonly intent: AccountOnboardingIntent | null;
  readonly providers: readonly AccountOnboardingProvider[] | null;
  readonly stage: AccountOnboardingStage;
}

interface AccountOnboardingWriteInput {
  readonly accountId: string;
  readonly now: Date;
}

export interface SetAccountOnboardingIntentInput extends AccountOnboardingWriteInput {
  readonly intent: AccountOnboardingIntent;
}

export interface SetAccountOnboardingProvidersInput extends AccountOnboardingWriteInput {
  readonly providers: readonly AccountOnboardingProvider[];
}

type MaybePromise<T> = T | Promise<T>;

export interface AccountOnboardingRepository {
  findByAccountId(accountId: string): MaybePromise<AccountOnboardingRecord | null>;
  setIntent(input: SetAccountOnboardingIntentInput): MaybePromise<AccountOnboardingRecord>;
  setProviders(
    input: SetAccountOnboardingProvidersInput,
  ): MaybePromise<AccountOnboardingRecord | null>;
  complete(input: AccountOnboardingWriteInput): MaybePromise<AccountOnboardingRecord | null>;
}
