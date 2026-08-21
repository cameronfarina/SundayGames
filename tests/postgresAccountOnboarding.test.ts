import { describe, expect, it } from "vitest";
import { PostgresAccountOnboardingRepository } from "../src/platform/accountOnboarding.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

const now = new Date("2026-08-21T14:00:00.000Z");
const row = {
  account_id: "account-1",
  completed_at: null,
  created_at: now,
  intent: "practice",
  intent_both: false,
  providers_json: ["espn", "other"],
  updated_at: now,
};

class QueuedClient implements PostgresQueryClient {
  readonly queries: Array<{ sql: string; values: readonly unknown[] }> = [];
  readonly results: Array<readonly unknown[]> = [];

  query<TRow = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    this.queries.push({ sql, values });
    return { rows: [...(this.results.shift() ?? [])] };
  }
}

describe("Postgres account onboarding", () => {
  it("maps the durable profile and writes provider answers as JSON", async () => {
    const client = new QueuedClient();
    client.results.push([row], [row]);
    const repository = new PostgresAccountOnboardingRepository(client);

    await expect(repository.findByAccountId("account-1")).resolves.toMatchObject({
      accountId: "account-1",
      intent: "practice",
      providers: ["espn", "other"],
    });
    await repository.setProviders({ accountId: "account-1", providers: ["espn", "other"], now });

    expect(client.queries[1]).toMatchObject({
      values: ["account-1", "[\"espn\",\"other\"]", now],
    });
    expect(client.queries[1]?.sql).toContain("intent IS NOT NULL AND completed_at IS NULL");
  });

  it("rejects an invalid intent read from storage", async () => {
    const client = new QueuedClient();
    client.results.push([{ ...row, intent: "unsupported" }]);
    const repository = new PostgresAccountOnboardingRepository(client);

    await expect(repository.findByAccountId("account-1"))
      .rejects.toThrow("Invalid account onboarding intent.");
  });

  it("reads a future combined-intent row as the legacy live-draft intent", async () => {
    const client = new QueuedClient();
    client.results.push([{ ...row, intent: "live_draft", intent_both: true }]);
    const repository = new PostgresAccountOnboardingRepository(client);

    await expect(repository.findByAccountId("account-1"))
      .resolves.toMatchObject({ intent: "both", intentBoth: true });
  });

  it("stores both as a legacy live-draft value with the combined flag", async () => {
    const client = new QueuedClient();
    client.results.push([{ ...row, intent: "live_draft", intent_both: true }]);
    const repository = new PostgresAccountOnboardingRepository(client);

    await expect(repository.setIntent({
      accountId: "account-1",
      intent: "both",
      now,
    })).resolves.toMatchObject({ intent: "both" });

    expect(client.queries[0]).toMatchObject({
      values: ["account-1", "live_draft", true, now],
    });
  });

  it.each([null, "practice"])(
    "rejects a combined marker paired with the invalid intent %s",
    async intent => {
      const client = new QueuedClient();
      client.results.push([{ ...row, intent, intent_both: true }]);
      const repository = new PostgresAccountOnboardingRepository(client);

      await expect(repository.findByAccountId("account-1"))
        .rejects.toThrow("Invalid account onboarding combined intent.");
    },
  );

  it("clears the reserved combined-intent flag when a legacy intent is saved", async () => {
    const client = new QueuedClient();
    client.results.push([{ ...row, intent: "live_draft" }]);
    const repository = new PostgresAccountOnboardingRepository(client);

    await expect(repository.setIntent({
      accountId: "account-1",
      intent: "live_draft",
      now,
    })).resolves.toMatchObject({ intent: "live_draft" });

    expect(client.queries[0]).toMatchObject({
      values: ["account-1", "live_draft", false, now],
    });
  });

  it("does not overwrite a completed profile from a stale setup step", async () => {
    const client = new QueuedClient();
    client.results.push([], [{ ...row, completed_at: now }]);
    const repository = new PostgresAccountOnboardingRepository(client);

    await expect(repository.setIntent({
      accountId: "account-1",
      intent: "live_draft",
      now,
    })).resolves.toMatchObject({ intent: "practice", completedAt: now });

    expect(client.queries[0]?.sql).toContain("completed_at IS NULL");
  });

  it("preserves the original completion timestamp when completion is retried", async () => {
    const client = new QueuedClient();
    const originalCompletion = new Date("2026-08-21T14:05:00.000Z");
    client.results.push([], [{ ...row, completed_at: originalCompletion }]);
    const repository = new PostgresAccountOnboardingRepository(client);

    await expect(repository.complete({ accountId: "account-1", now }))
      .resolves.toMatchObject({ completedAt: originalCompletion });

    expect(client.queries[0]?.sql).toContain("completed_at IS NULL");
  });
});
