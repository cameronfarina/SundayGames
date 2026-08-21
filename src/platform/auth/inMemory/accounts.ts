import { AuthError } from "../errors.js";
import type {
  AccountCredentialRecord,
  AccountRecord,
  CreateAccountRecordInput,
  CreatePendingAccountInput,
  PendingAccountRegistrationResult,
  ReplaceDisplayNameInput,
} from "../records.js";
import type { InMemoryAuthState } from "./state.js";

export const createAccount = (state: InMemoryAuthState, input: CreateAccountRecordInput): AccountRecord => {
  if (state.accountIdsByEmail.has(input.email)) {
    throw new AuthError("duplicate_email", "An account with this email already exists.");
  }
  const account: AccountRecord = {
    id: input.id,
    email: input.email,
    emailVerifiedAt: input.emailVerifiedAt ?? input.now,
    createdAt: input.now,
    updatedAt: input.now,
  };
  state.accountsById.set(input.id, { account, passwordHash: input.passwordHash });
  state.accountIdsByEmail.set(input.email, input.id);
  state.authVersionsByAccountId.set(input.id, 1);
  return account;
};

export const createPendingAccount = (
  state: InMemoryAuthState,
  input: CreatePendingAccountInput,
): PendingAccountRegistrationResult => {
  const existingId = state.accountIdsByEmail.get(input.email);
  if (existingId === undefined) {
    const account: AccountRecord = {
      id: input.id,
      email: input.email,
      createdAt: input.now,
      updatedAt: input.now,
    };
    state.accountsById.set(input.id, { account, passwordHash: input.passwordHash });
    state.accountIdsByEmail.set(input.email, input.id);
    state.authVersionsByAccountId.set(input.id, 1);
    return { account, status: "created", credentialVersion: 1 };
  }
  const existing = state.accountsById.get(existingId);
  if (existing === undefined) throw new Error("Auth email index is inconsistent.");
  return { account: existing.account, status: "existing" };
};

export const findAccountCredentialByEmail = (
  state: InMemoryAuthState,
  normalizedEmail: string,
): AccountCredentialRecord | null => {
  const accountId = state.accountIdsByEmail.get(normalizedEmail);
  return accountId === undefined ? null : state.accountsById.get(accountId) ?? null;
};

export const findAccountById = (state: InMemoryAuthState, accountId: string): AccountRecord | null =>
  state.accountsById.get(accountId)?.account ?? null;

export const replaceDisplayName = (
  state: InMemoryAuthState,
  input: ReplaceDisplayNameInput,
): AccountRecord | null => {
  const existing = state.accountsById.get(input.accountId);
  if (existing === undefined) return null;
  const { emailVerifiedAt } = existing.account;
  const account: AccountRecord = {
    id: existing.account.id,
    email: existing.account.email,
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(emailVerifiedAt === undefined ? {} : { emailVerifiedAt }),
    createdAt: existing.account.createdAt,
    updatedAt: input.now,
  };
  state.accountsById.set(input.accountId, { account, passwordHash: existing.passwordHash });
  return account;
};
