import { describe, expect, it } from "vitest";
import { PostgresLeagueConnectionRepository } from "../src/platform/postgresLeagueConnections.js";
import { createLeagueConnectionCredentialCipher } from
  "../src/platform/leagueConnectionCredentialEncryption.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

class RecordingClient implements PostgresTransactionalQueryClient {
  readonly queries: RecordedQuery[] = [];
  #nextRows: unknown[] = [];
  #nextRowCount = 0;

  answerWith(rows: readonly unknown[], rowCount = rows.length): void {
    this.#nextRows = [...rows];
    this.#nextRowCount = rowCount;
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return await operation(this);
  }

  query<TRow = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(sql: string, values: readonly unknown[] = []): Promise<PostgresQueryResult<unknown>> {
    this.queries.push({ sql: sql.replace(/\s+/gu, " ").trim(), values });
    const rows = this.#nextRows;
    const rowCount = this.#nextRowCount;
    this.#nextRows = [];
    this.#nextRowCount = 0;
    return { rows, rowCount };
  }
}

const connectionRow = {
  id: "league_connection_1",
  account_id: "account-1",
  provider: "espn",
  provider_league_id: "899513",
  season: "2025",
  display_name: "Pigskin Power Bottoms",
  status: "needs_attention",
  status_detail: "This ESPN league is private.",
  last_synced_at: new Date("2026-08-19T12:00:00.000Z"),
  league_season_id: null,
  created_at: "2026-08-18T12:00:00.000Z",
  updated_at: new Date("2026-08-19T12:00:00.000Z"),
};

const credentialCipher = createLeagueConnectionCredentialCipher({
  activeKeyId: "test-v1",
  keys: { "test-v1": Buffer.alloc(32, 7).toString("base64") },
});
const previousCredentialCipher = createLeagueConnectionCredentialCipher({
  activeKeyId: "test-v0",
  keys: { "test-v0": Buffer.alloc(32, 6).toString("base64") },
});
const rotatingCredentialCipher = createLeagueConnectionCredentialCipher({
  activeKeyId: "test-v1",
  keys: {
    "test-v0": Buffer.alloc(32, 6).toString("base64"),
    "test-v1": Buffer.alloc(32, 7).toString("base64"),
  },
});

describe("postgres league connection repository", () => {
  it("reads a connection row into the domain record", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);
    client.answerWith([connectionRow]);

    expect(await repository.findConnection("account-1", "league_connection_1")).toEqual({
      id: "league_connection_1",
      accountId: "account-1",
      provider: "espn",
      providerLeagueId: "899513",
      season: "2025",
      displayName: "Pigskin Power Bottoms",
      status: "needs_attention",
      statusDetail: "This ESPN league is private.",
      lastSyncedAt: "2026-08-19T12:00:00.000Z",
      createdAt: "2026-08-18T12:00:00.000Z",
      updatedAt: "2026-08-19T12:00:00.000Z",
    });
  });

  it("reports the season a connection was imported into", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);
    client.answerWith([{ ...connectionRow, league_season_id: "season-1" }]);

    expect(await repository.findConnection("account-1", "league_connection_1"))
      .toMatchObject({ leagueSeasonId: "season-1" });
  });

  it("links a connection to the season it produced", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);

    await repository.linkConnectionToSeason("league_connection_1", "season-1");

    expect(client.queries[0]?.sql).toContain("SET league_season_id = $2");
    expect(client.queries[0]?.values.slice(0, 2)).toEqual(["league_connection_1", "season-1"]);
  });

  it("falls back rather than trusting an unknown provider or status from the database", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);
    client.answerWith([{
      ...connectionRow,
      provider: "nfl-dot-com",
      status: "half-done",
      status_detail: null,
      last_synced_at: null,
    }]);

    expect(await repository.findConnection("account-1", "league_connection_1")).toMatchObject({
      provider: "sleeper",
      status: "error",
    });
  });

  it("does not store credential-shaped input for providers that cannot use it", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);
    client.answerWith([connectionRow]);

    await repository.saveConnection({
      accountId: "account-1",
      provider: "sleeper",
      providerLeagueId: "289646328504385536",
      season: "2018",
      displayName: "Sleeper Friends League",
      credentials: { espnS2: "must-not-be-stored", swid: "{MUST-NOT-BE-STORED}" },
      now: new Date("2026-08-19T12:00:00.000Z"),
    });

    expect(client.queries[0]?.values.slice(1)).toEqual([
      "account-1",
      "sleeper",
      "289646328504385536",
      "2018",
      "Sleeper Friends League",
      null,
      null,
      "2026-08-19T12:00:00.000Z",
    ]);
  });

  it("never binds supplied ESPN session credentials as plaintext", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client, credentialCipher);
    client.answerWith([connectionRow]);

    await repository.saveConnection({
      accountId: "account-1",
      provider: "espn",
      providerLeagueId: "899513",
      season: "2025",
      displayName: "Pigskin Power Bottoms",
      credentials: { espnS2: "s2-secret-value", swid: "{SECRET-GUID}" },
      now: new Date("2026-08-19T12:00:00.000Z"),
    });

    const persistedValues = JSON.stringify(client.queries[0]?.values);
    expect(persistedValues).not.toContain("s2-secret-value");
    expect(persistedValues).not.toContain("{SECRET-GUID}");
    expect(client.queries[0]?.sql).toContain("credentials_ciphertext");
  });

  it("refuses to invent a connection when the upsert returns nothing", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);

    await expect(repository.saveConnection({
      accountId: "account-1",
      provider: "sleeper",
      providerLeagueId: "1",
      season: "2018",
      displayName: "League",
    })).rejects.toThrow("Saving a league connection returned no row.");
  });

  it("reads credential columns without leaking absent values as empty strings", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);
    client.answerWith([{
      account_id: "account-1",
      provider_league_id: "899513",
      season: "2025",
      espn_s2: "s2-value",
      swid: null,
      credentials_ciphertext: null,
      credentials_key_id: null,
      credential_row_version: "101",
    }]);

    expect(await repository.findCredentials("league_connection_1")).toEqual({ espnS2: "s2-value" });
  });

  it("prefers rolling-deploy plaintext and adds ciphertext without breaking old-process reads", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client, credentialCipher);
    client.answerWith([{
      account_id: "account-1",
      provider_league_id: "899513",
      season: "2025",
      espn_s2: "new-s2-from-old-server",
      swid: "{NEW-GUID}",
      credentials_ciphertext: "stale-ciphertext",
      credentials_key_id: "test-v1",
      credential_row_version: "102",
    }]);

    await expect(repository.findCredentials("league_connection_1")).resolves.toEqual({
      espnS2: "new-s2-from-old-server",
      swid: "{NEW-GUID}",
    });
    expect(client.queries).toHaveLength(2);
    expect(client.queries[1]?.sql).toContain("xmin::text = $4");
    expect(client.queries[1]?.sql).not.toContain("espn_s2 = NULL");
    expect(client.queries[1]?.sql).not.toContain("swid = NULL");
    expect(JSON.stringify(client.queries[1]?.values)).not.toContain("new-s2-from-old-server");
    expect(JSON.stringify(client.queries[1]?.values)).not.toContain("{NEW-GUID}");
  });

  it("rewrites an envelope after decrypting it with a retained rotation key", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client, rotatingCredentialCipher);
    const encrypted = previousCredentialCipher.encrypt({
      espnS2: "old-key-s2",
      swid: "{OLD-KEY-GUID}",
    }, {
      accountId: "account-1",
      providerLeagueId: "899513",
      season: "2025",
    });
    client.answerWith([{
      account_id: "account-1",
      provider_league_id: "899513",
      season: "2025",
      espn_s2: null,
      swid: null,
      credentials_ciphertext: encrypted.ciphertext,
      credentials_key_id: encrypted.keyId,
      credential_row_version: "103",
    }]);

    await expect(repository.findCredentials("league_connection_1")).resolves.toEqual({
      espnS2: "old-key-s2",
      swid: "{OLD-KEY-GUID}",
    });
    expect(client.queries).toHaveLength(2);
    expect(client.queries[1]?.sql).toContain("credentials_ciphertext IS NOT DISTINCT FROM $4");
    expect(client.queries[1]?.values[2]).toBe("test-v1");
    expect(JSON.stringify(client.queries[1]?.values)).not.toContain("old-key-s2");
  });

  it("decodes a stored snapshot and ignores one that no longer matches the contract", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);
    client.answerWith([{
      connection_id: "league_connection_1",
      settings_json: JSON.stringify({
        name: "Pigskin Power Bottoms",
        season: "2025",
        teamCount: 12,
        rosterPositions: ["QB"],
        scoring: { rec: 1 },
      }),
      teams_json: [{ providerTeamId: "1", name: "Bad team" }],
      matchups_json: [{ week: 1, matchupKey: "1-1", homeTeamId: "1", homePoints: 100 }],
      synced_at: "2026-08-19T12:00:00.000Z",
    }]);

    const snapshot = await repository.findSnapshot("league_connection_1");

    expect(snapshot?.settings.name).toBe("Pigskin Power Bottoms");
    // A league missing one team would misreport standings, so the whole team
    // list is dropped and the owner is offered a fresh sync instead.
    expect(snapshot?.teams).toEqual([]);
    expect(snapshot?.matchups).toHaveLength(1);
  });

  it("reports whether a delete removed anything", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);
    client.answerWith([], 1);

    expect(await repository.deleteConnection("account-1", "league_connection_1")).toBe(true);
    expect(await repository.deleteConnection("account-1", "league_connection_1")).toBe(false);
  });

  it("stores and reads the cached player directory as one row per provider", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);

    await repository.savePlayerDirectory({
      provider: "sleeper",
      entries: { "4035": { name: "Alvin Kamara", position: "RB" } },
      fetchedAt: "2026-08-19T12:00:00.000Z",
    });
    client.answerWith([{
      provider: "sleeper",
      entries_json: { "4035": { name: "Alvin Kamara", position: "RB" }, bad: { position: "RB" } },
      fetched_at: new Date("2026-08-19T12:00:00.000Z"),
    }]);

    expect(client.queries[0]?.values).toEqual([
      "sleeper",
      "{\"4035\":{\"name\":\"Alvin Kamara\",\"position\":\"RB\"}}",
      "2026-08-19T12:00:00.000Z",
    ]);
    // One malformed entry must not cost the whole cached directory.
    expect(await repository.findPlayerDirectory("sleeper")).toMatchObject({
      entries: { "4035": { name: "Alvin Kamara", position: "RB" } },
    });
  });

  it("lists connections for one account only", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);
    client.answerWith([connectionRow]);

    await repository.listConnections("account-1");

    expect(client.queries[0]?.sql).toContain("WHERE account_id = $1");
    expect(client.queries[0]?.values).toEqual(["account-1"]);
  });

  it("keeps the previous sync time when a failed sync only records a status", async () => {
    const client = new RecordingClient();
    const repository = new PostgresLeagueConnectionRepository(client);

    await repository.updateConnectionStatus({
      id: "league_connection_1",
      status: "error",
      statusDetail: "Sleeper did not respond.",
      now: new Date("2026-08-19T12:00:00.000Z"),
    });

    expect(client.queries[0]?.sql).toContain("last_synced_at = COALESCE($4, last_synced_at)");
    expect(client.queries[0]?.values[3]).toBeNull();
  });
});
