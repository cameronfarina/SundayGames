import type {
  AccountCredentialRecord,
  AccountRecord,
  SessionRecord,
} from "../../auth.js";
import type { InMemoryPlatformStoreSnapshot } from "../../platformApp.js";
import {
  arrayValue,
  dateValue,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const accountValue = (value: unknown, path: string): AccountRecord => {
  const record = recordValue(value, path);
  return {
    id: stringValue(record.id, `${path}.id`),
    email: stringValue(record.email, `${path}.email`),
    emailVerifiedAt: optionalValue(record.emailVerifiedAt, `${path}.emailVerifiedAt`, dateValue),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    updatedAt: dateValue(record.updatedAt, `${path}.updatedAt`),
  };
};

const credentialValue = (value: unknown, path: string): AccountCredentialRecord => {
  const record = recordValue(value, path);
  return {
    account: accountValue(record.account, `${path}.account`),
    passwordHash: stringValue(record.passwordHash, `${path}.passwordHash`),
  };
};

const sessionValue = (value: unknown, path: string): SessionRecord => {
  const record = recordValue(value, path);
  return {
    id: stringValue(record.id, `${path}.id`),
    accountId: stringValue(record.accountId, `${path}.accountId`),
    tokenHash: stringValue(record.tokenHash, `${path}.tokenHash`),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    expiresAt: dateValue(record.expiresAt, `${path}.expiresAt`),
    revokedAt: optionalValue(record.revokedAt, `${path}.revokedAt`, dateValue),
  };
};

export const authValue = (
  value: unknown,
  path: string,
): InMemoryPlatformStoreSnapshot["auth"] => {
  const record = recordValue(value, path);
  return {
    accountCredentials: arrayValue(
      record.accountCredentials,
      `${path}.accountCredentials`,
      credentialValue,
    ),
    sessions: arrayValue(record.sessions, `${path}.sessions`, sessionValue),
  };
};
