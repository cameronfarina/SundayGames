import type { LeagueConnectionCredentials } from "../leagueConnections.js";
import type {
  EncryptedLeagueConnectionCredentials,
  LeagueConnectionCredentialCipher,
  LeagueConnectionCredentialContext,
} from "../leagueConnectionCredentialEncryption.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { LeagueConnectionCredentialRow } from "./contracts.js";
import {
  populateLegacyCredentialEnvelopeSql,
  rotateEncryptedCredentialsSql,
  selectCredentialsSql,
} from "./sql.js";

const trimmedOrNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
};

export class PostgresLeagueConnectionCredentialStore {
  readonly #client: PostgresTransactionalQueryClient;
  readonly #cipher: LeagueConnectionCredentialCipher | undefined;

  constructor(
    client: PostgresTransactionalQueryClient,
    cipher?: LeagueConnectionCredentialCipher,
  ) {
    this.#client = client;
    this.#cipher = cipher;
  }

  encryptedFor(
    credentials: LeagueConnectionCredentials | undefined,
    context: LeagueConnectionCredentialContext,
  ): EncryptedLeagueConnectionCredentials | undefined {
    const espnS2 = trimmedOrNull(credentials?.espnS2);
    const swid = trimmedOrNull(credentials?.swid);
    const normalized = {
      ...(espnS2 === null ? {} : { espnS2 }),
      ...(swid === null ? {} : { swid }),
    };
    if (normalized.espnS2 === undefined && normalized.swid === undefined) return undefined;
    if (this.#cipher === undefined) throw new Error("ESPN credential encryption is not configured.");
    return this.#cipher.encrypt(normalized, context);
  }

  async find(id: string): Promise<LeagueConnectionCredentials | null> {
    const result = await this.#client.query<LeagueConnectionCredentialRow>(selectCredentialsSql, [id]);
    const row = result.rows[0];
    if (row === undefined) return null;
    const context = {
      accountId: row.account_id,
      providerLeagueId: row.provider_league_id,
      season: row.season,
    };
    const legacyCredentials: LeagueConnectionCredentials = {
      ...(row.espn_s2 === null ? {} : { espnS2: row.espn_s2 }),
      ...(row.swid === null ? {} : { swid: row.swid }),
    };
    if (legacyCredentials.espnS2 !== undefined || legacyCredentials.swid !== undefined) {
      await this.#populateLegacyEnvelope(id, row, legacyCredentials, context);
      return legacyCredentials;
    }
    if (row.credentials_ciphertext === null && row.credentials_key_id === null) return {};
    if (
      row.credentials_ciphertext === null
      || row.credentials_key_id === null
      || this.#cipher === undefined
    ) throw new Error("Stored ESPN credentials could not be decrypted.");
    const encrypted = {
      ciphertext: row.credentials_ciphertext,
      keyId: row.credentials_key_id,
    };
    const credentials = this.#cipher.decrypt(encrypted, context);
    if (row.credentials_key_id !== this.#cipher.activeKeyId) {
      const rotated = this.#cipher.encrypt(credentials, context);
      await this.#client.query(rotateEncryptedCredentialsSql, [
        id,
        rotated.ciphertext,
        rotated.keyId,
        row.credentials_ciphertext,
        row.credentials_key_id,
        new Date().toISOString(),
      ]);
    }
    return credentials;
  }

  async #populateLegacyEnvelope(
    id: string,
    row: LeagueConnectionCredentialRow,
    credentials: LeagueConnectionCredentials,
    context: LeagueConnectionCredentialContext,
  ): Promise<void> {
    if (this.#cipher === undefined) return;
    const encrypted = this.#cipher.encrypt(credentials, context);
    await this.#client.query(populateLegacyCredentialEnvelopeSql, [
      id,
      encrypted.ciphertext,
      encrypted.keyId,
      row.credential_row_version,
      new Date().toISOString(),
    ]);
  }
}
