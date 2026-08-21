import type {
  AccountOnboardingRecord,
  AccountOnboardingRepository,
  SetAccountOnboardingIntentInput,
  SetAccountOnboardingProvidersInput,
} from "./contracts.js";

const clone = (record: AccountOnboardingRecord): AccountOnboardingRecord => ({
  ...record,
  providers: record.providers === null ? null : [...record.providers],
  completedAt: record.completedAt === null ? null : new Date(record.completedAt),
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
});

export class InMemoryAccountOnboardingRepository implements AccountOnboardingRepository {
  readonly #records = new Map<string, AccountOnboardingRecord>();

  constructor(records: readonly AccountOnboardingRecord[] = []) {
    for (const record of records) this.#records.set(record.accountId, clone(record));
  }

  findByAccountId(accountId: string): AccountOnboardingRecord | null {
    const record = this.#records.get(accountId);
    return record === undefined ? null : clone(record);
  }

  setIntent(input: SetAccountOnboardingIntentInput): AccountOnboardingRecord {
    const current = this.#records.get(input.accountId);
    if (current?.completedAt !== null && current?.completedAt !== undefined) return clone(current);
    const record: AccountOnboardingRecord = {
      accountId: input.accountId,
      intent: input.intent,
      providers: current?.providers ?? null,
      completedAt: null,
      createdAt: current?.createdAt ?? input.now,
      updatedAt: input.now,
    };
    this.#records.set(input.accountId, record);
    return clone(record);
  }

  setProviders(input: SetAccountOnboardingProvidersInput): AccountOnboardingRecord | null {
    const current = this.#records.get(input.accountId);
    if (current === undefined || current.intent === null) return null;
    if (current.completedAt !== null) return clone(current);
    const record = { ...current, providers: [...input.providers], updatedAt: input.now };
    this.#records.set(input.accountId, record);
    return clone(record);
  }

  complete(input: { readonly accountId: string; readonly now: Date }): AccountOnboardingRecord | null {
    const current = this.#records.get(input.accountId);
    if (current === undefined || current.intent === null || current.providers === null) return null;
    if (current.completedAt !== null) return clone(current);
    const record = { ...current, completedAt: input.now, updatedAt: input.now };
    this.#records.set(input.accountId, record);
    return clone(record);
  }

  records(): readonly AccountOnboardingRecord[] {
    return [...this.#records.values()].map(clone);
  }

  replaceRecords(records: readonly AccountOnboardingRecord[]): void {
    this.#records.clear();
    for (const record of records) this.#records.set(record.accountId, clone(record));
  }
}
