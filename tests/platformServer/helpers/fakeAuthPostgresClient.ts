import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../../../src/platform/postgresPlatformStore.js";
import type { StoredAuthAccountRow, StoredAuthSessionRow } from "./postgresRows.js";
import {
  cloneAuthAccountRow,
  cloneAuthSessionRow,
  dateValueAt,
  normalizeSql,
  optionalStringValueAt,
  stringValueAt,
} from "./postgresRowUtilities.js";

export class FakePostgresAuthClient implements PostgresQueryClient {
  readonly accounts = new Map<string, StoredAuthAccountRow>();
  readonly sessions = new Map<string, StoredAuthSessionRow>();

  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("INSERT INTO accounts")) {
      const id = stringValueAt(values, 0);
      const email = stringValueAt(values, 1);
      const passwordHash = stringValueAt(values, 2);
      const emailVerifiedAt = dateValueAt(values, 3);
      const createdAt = dateValueAt(values, 4);
      const existing = [...this.accounts.values()].find(account => account.email_normalized === email);
      if (existing !== undefined) return { rows: [], rowCount: 0 };

      const row: StoredAuthAccountRow = {
        id,
        email,
        email_normalized: email,
        password_hash: passwordHash,
        email_verified_at: emailVerifiedAt,
        auth_version: 1,
        status: "active",
        created_at: createdAt,
        updated_at: createdAt,
      };
      this.accounts.set(id, row);

      return { rows: [cloneAuthAccountRow(row)], rowCount: 1 };
    }

    if (normalizedSql.includes("FROM accounts") && normalizedSql.includes("WHERE email_normalized = $1")) {
      const email = stringValueAt(values, 0);
      const activeOnly = normalizedSql.includes("status = 'active'");
      const row = [...this.accounts.values()]
        .find(account => account.email_normalized === email && (!activeOnly || account.status === "active"));

      return { rows: row === undefined ? [] : [cloneAuthAccountRow(row)] };
    }

    if (normalizedSql.includes("FROM accounts") && normalizedSql.includes("WHERE id = $1")) {
      const accountId = stringValueAt(values, 0);
      const row = this.accounts.get(accountId);
      if (normalizedSql.includes("status = 'active'") && row?.status !== "active") {
        return { rows: [] };
      }

      return { rows: row === undefined ? [] : [cloneAuthAccountRow(row)] };
    }

    if (normalizedSql.startsWith("INSERT INTO sessions")) {
      const id = stringValueAt(values, 0);
      const accountId = stringValueAt(values, 1);
      const tokenHash = stringValueAt(values, 2);
      const expiresAt = dateValueAt(values, 3);
      const createdAt = dateValueAt(values, 4);
      const expectedPasswordHash = optionalStringValueAt(values, 5);
      const account = this.accounts.get(accountId);
      if (
        account === undefined ||
        (expectedPasswordHash !== undefined && (
          account.status !== "active" || account.password_hash !== expectedPasswordHash
        ))
      ) {
        return { rows: [], rowCount: 0 };
      }
      const row: StoredAuthSessionRow = {
        id,
        account_id: accountId,
        token_hash: tokenHash,
        auth_version: account.auth_version,
        created_at: createdAt,
        expires_at: expiresAt,
        revoked_at: null,
      };
      this.sessions.set(id, row);

      return { rows: [cloneAuthSessionRow(row)], rowCount: 1 };
    }

    if (normalizedSql.includes("FROM sessions") && normalizedSql.includes("WHERE sessions.token_hash = $1")) {
      const tokenHash = stringValueAt(values, 0);
      const row = [...this.sessions.values()].find(session => {
        if (session.token_hash !== tokenHash) return false;
        const account = this.accounts.get(session.account_id);

        return account?.status === "active" && account.auth_version === session.auth_version;
      });

      return { rows: row === undefined ? [] : [cloneAuthSessionRow(row)] };
    }

    if (normalizedSql.includes("FROM sessions") && normalizedSql.includes("WHERE sessions.id = $1")) {
      const sessionId = stringValueAt(values, 0);
      const row = this.sessions.get(sessionId);

      return { rows: row === undefined ? [] : [cloneAuthSessionRow(row)] };
    }

    if (normalizedSql.startsWith("UPDATE sessions SET revoked_at")) {
      const sessionId = stringValueAt(values, 0);
      const revokedAt = dateValueAt(values, 1);
      const row = this.sessions.get(sessionId);
      if (row === undefined) return { rows: [], rowCount: 0 };

      row.revoked_at = revokedAt;

      return { rows: [cloneAuthSessionRow(row)], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }
}
