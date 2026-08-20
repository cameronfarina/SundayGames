import { describe, expect, it } from "vitest";
import { backfillLeagueConnectionCredentials } from
  "../src/platform/leagueConnectionCredentialBackfill.js";
import {
  createLeagueConnectionCredentialCipher,
  type LeagueConnectionCredentialCipher,
} from
  "../src/platform/leagueConnectionCredentialEncryption.js";
import type { PostgresTransactionalQueryClient } from
  "../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

class BackfillClient implements PostgresTransactionalQueryClient {
  readonly queries: RecordedQuery[] = [];
  readonly eligibleRowsRemain: boolean;
  readonly rows: readonly Record<string, unknown>[];

  constructor(rows: readonly Record<string, unknown>[], eligibleRowsRemain = false) {
    this.rows = rows;
    this.eligibleRowsRemain = eligibleRowsRemain;
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return await operation(this);
  }

  async query<TRow = Record<string, unknown>>(
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ sql: sql.replace(/\s+/gu, " ").trim(), values });
    if (sql.includes("FOR UPDATE SKIP LOCKED")) {
      return { rows: this.rows as TRow[] };
    }
    if (sql.includes("AS backfill_complete")) {
      return { rows: [{ backfill_complete: !this.eligibleRowsRemain }] as TRow[] };
    }
    return { rows: [], rowCount: 1 };
  }
}

const oldKey = Buffer.alloc(32, 6).toString("base64");
const newKey = Buffer.alloc(32, 7).toString("base64");
const oldCipher = createLeagueConnectionCredentialCipher({
  activeKeyId: "credentials-v0",
  keys: { "credentials-v0": oldKey },
});
const rotatingCipher = createLeagueConnectionCredentialCipher({
  activeKeyId: "credentials-v1",
  keys: { "credentials-v0": oldKey, "credentials-v1": newKey },
});

describe("league connection credential backfill", () => {
  it("encrypts legacy rows and rotates old envelopes without binding plaintext to updates", async () => {
    const context = {
      accountId: "account-1",
      providerLeagueId: "899513",
      season: "2026",
    };
    const oldEnvelope = oldCipher.encrypt({ espnS2: "retired-key-s2", swid: "{OLD-GUID}" }, context);
    const mixedContext = {
      accountId: "account-2",
      providerLeagueId: "654321",
      season: "2026",
    };
    const staleEnvelope = rotatingCipher.encrypt({
      espnS2: "stale-cipher-s2",
      swid: "{STALE-CIPHER-GUID}",
    }, mixedContext);
    const client = new BackfillClient([
      {
        id: "connection-legacy",
        account_id: "account-1",
        provider: "espn",
        provider_league_id: "123456",
        season: "2026",
        espn_s2: "legacy-s2-secret",
        swid: "{LEGACY-GUID}",
        credentials_ciphertext: null,
        credentials_key_id: null,
      },
      {
        id: "connection-old-key",
        account_id: context.accountId,
        provider: "espn",
        provider_league_id: context.providerLeagueId,
        season: context.season,
        espn_s2: null,
        swid: null,
        credentials_ciphertext: oldEnvelope.ciphertext,
        credentials_key_id: oldEnvelope.keyId,
      },
      {
        id: "connection-mixed",
        account_id: mixedContext.accountId,
        provider: "espn",
        provider_league_id: mixedContext.providerLeagueId,
        season: mixedContext.season,
        espn_s2: "current-plaintext-s2",
        swid: "{CURRENT-PLAINTEXT-GUID}",
        credentials_ciphertext: staleEnvelope.ciphertext,
        credentials_key_id: staleEnvelope.keyId,
      },
    ]);

    await expect(backfillLeagueConnectionCredentials(
      client,
      rotatingCipher,
      25,
      new Date("2026-08-20T12:00:00.000Z"),
    )).resolves.toEqual({ complete: false, examined: 3, migrated: 3 });

    expect(client.queries[0]?.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(client.queries[0]?.sql).toContain("credentials_ciphertext IS NOT NULL");
    expect(client.queries[0]?.values).toEqual(["credentials-v1", 25]);
    const updateValues = JSON.stringify(client.queries.slice(1).map(query => query.values));
    expect(updateValues).not.toContain("legacy-s2-secret");
    expect(updateValues).not.toContain("{LEGACY-GUID}");
    expect(updateValues).not.toContain("retired-key-s2");
    expect(client.queries.slice(1).map(query => query.values[2]))
      .toEqual(["credentials-v1", "credentials-v1", "credentials-v1"]);
    expect(client.queries.slice(1).every(query =>
      query.sql.includes("espn_s2 = NULL") && query.sql.includes("swid = NULL")
    )).toBe(true);
    const mixedUpdate = client.queries[3];
    expect(rotatingCipher.decrypt({
      ciphertext: String(mixedUpdate?.values[1]),
      keyId: String(mixedUpdate?.values[2]),
    }, mixedContext)).toEqual({
      espnS2: "current-plaintext-s2",
      swid: "{CURRENT-PLAINTEXT-GUID}",
    });
  });

  it("clears historical non-ESPN plaintext without encrypting it or reporting completion early", async () => {
    const client = new BackfillClient([{
      id: "connection-sleeper",
      account_id: "account-1",
      provider: "sleeper",
      provider_league_id: "289646328504385536",
      season: "2018",
      espn_s2: "historical-s2-junk",
      swid: "{HISTORICAL-GUID}",
      credentials_ciphertext: null,
      credentials_key_id: null,
    }]);
    const refusingCipher: LeagueConnectionCredentialCipher = {
      activeKeyId: rotatingCipher.activeKeyId,
      decrypt: () => { throw new Error("Non-ESPN credentials must not be decrypted."); },
      encrypt: () => { throw new Error("Non-ESPN credentials must not be encrypted."); },
    };

    await expect(backfillLeagueConnectionCredentials(
      client,
      refusingCipher,
      25,
      new Date("2026-08-20T12:00:00.000Z"),
    )).resolves.toEqual({ complete: false, examined: 1, migrated: 1 });

    expect(client.queries[0]?.sql).toContain("WHERE espn_s2 IS NOT NULL");
    expect(client.queries[0]?.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(client.queries[1]?.sql).toContain("espn_s2 = NULL");
    expect(client.queries[1]?.sql).toContain("swid = NULL");
    expect(client.queries[1]?.sql).not.toContain("credentials_ciphertext = $2");
    expect(client.queries[1]?.values).toEqual([
      "connection-sleeper",
      "2026-08-20T12:00:00.000Z",
    ]);
  });

  it("does not report completion while an eligible row is locked elsewhere", async () => {
    const client = new BackfillClient([], true);

    await expect(backfillLeagueConnectionCredentials(client, rotatingCipher)).resolves.toEqual({
      complete: false,
      examined: 0,
      migrated: 0,
    });

    expect(client.queries[1]?.sql).toContain("AS backfill_complete");
    expect(client.queries[1]?.sql).toContain("espn_s2 IS NOT NULL");
    expect(client.queries[1]?.sql).toContain("swid IS NOT NULL");
  });

  it("reports completion only after the eligibility check is empty", async () => {
    const client = new BackfillClient([]);

    await expect(backfillLeagueConnectionCredentials(client, rotatingCipher)).resolves.toEqual({
      complete: true,
      examined: 0,
      migrated: 0,
    });
  });
});
