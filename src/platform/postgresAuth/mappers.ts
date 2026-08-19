import type {
  AccountCredentialRecord,
  AccountRecord,
  AuthTokenRecord,
  PasswordReplacementResult,
  SessionRecord,
} from "../auth.js";
import type { PostgresQueryResult } from "../postgresPlatformStore.js";
import type {
  AccountRow,
  AuthTokenRow,
  PasswordReplacementRow,
  SessionRow,
} from "./rows.js";

export const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined =>
  result.rows[0];

export const credentialVersionFromDb = (value: string | number): number => {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Postgres auth row has invalid auth_version.");
  }
  return version;
};

const dateFromDb = (value: Date | string | null | undefined): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const requiredDateFromDb = (table: string, field: string, value: Date | string): Date => {
  const date = dateFromDb(value);
  if (date === undefined) throw new Error(`Postgres ${table} row has invalid ${field}.`);
  return date;
};

export const accountFromRow = (row: AccountRow): AccountRecord => {
  const emailVerifiedAt = dateFromDb(row.email_verified_at);
  return {
    id: row.id,
    email: row.email,
    ...(row.display_name === null ? {} : { displayName: row.display_name }),
    ...(emailVerifiedAt === undefined ? {} : { emailVerifiedAt }),
    createdAt: requiredDateFromDb("accounts", "created_at", row.created_at),
    updatedAt: requiredDateFromDb("accounts", "updated_at", row.updated_at),
  };
};

export const authTokenFromRow = (row: AuthTokenRow): AuthTokenRecord => ({
  id: row.id,
  accountId: row.account_id,
  purpose: row.purpose,
  tokenHash: row.token_hash,
  createdAt: requiredDateFromDb("account_auth_tokens", "created_at", row.created_at),
  expiresAt: requiredDateFromDb("account_auth_tokens", "expires_at", row.expires_at),
  consumedAt: dateFromDb(row.consumed_at),
});

export const accountCredentialFromRow = (row: AccountRow): AccountCredentialRecord => ({
  account: accountFromRow(row),
  passwordHash: row.password_hash,
});

export const sessionFromRow = (row: SessionRow): SessionRecord => ({
  id: row.id,
  accountId: row.account_id,
  tokenHash: row.token_hash,
  createdAt: requiredDateFromDb("sessions", "created_at", row.created_at),
  expiresAt: requiredDateFromDb("sessions", "expires_at", row.expires_at),
  revokedAt: dateFromDb(row.revoked_at),
});

export const passwordReplacementFromRow = (
  row: PasswordReplacementRow,
  operation: "replacement" | "reset",
): PasswordReplacementResult => {
  const revokedSessionCount = Number(row.revoked_session_count);
  if (!Number.isSafeInteger(revokedSessionCount) || revokedSessionCount < 0) {
    throw new Error(`Postgres password ${operation} returned an invalid revoked session count.`);
  }
  return { account: accountFromRow(row), revokedSessionCount };
};
