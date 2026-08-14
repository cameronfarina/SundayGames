import type { AuthTokenFinalizer } from "../repositoryContracts.js";
import type {
  AccountRecord,
  AuthTokenRecord,
  FindUsableAuthTokenInput,
  PasswordReplacementResult,
  ReplaceAuthTokenInput,
  ResetPasswordByTokenInput,
  VerifyEmailByTokenInput,
} from "../records.js";
import { replacePasswordAndRevokeSessions } from "./passwords.js";
import type { InMemoryAuthState } from "./state.js";

export const replaceAuthToken = (
  state: InMemoryAuthState,
  input: ReplaceAuthTokenInput,
): AuthTokenRecord | null => {
  const credentialVersion = state.authVersionsByAccountId.get(input.accountId);
  if (
    credentialVersion === undefined
    || (input.expectedCredentialVersion !== undefined && input.expectedCredentialVersion !== credentialVersion)
  ) return null;

  for (const [tokenHash, token] of state.authTokensByHash) {
    if (token.accountId === input.accountId && token.purpose === input.purpose && token.consumedAt === undefined) {
      state.authTokensByHash.set(tokenHash, { ...token, consumedAt: input.createdAt });
    }
  }
  const token: AuthTokenRecord = {
    id: input.id,
    accountId: input.accountId,
    purpose: input.purpose,
    tokenHash: input.tokenHash,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    consumedAt: undefined,
  };
  state.authTokensByHash.set(input.tokenHash, token);
  state.authVersionsByTokenHash.set(input.tokenHash, credentialVersion);
  return token;
};

export const withAuthTokenAdmission = async <TResult>(
  state: InMemoryAuthState,
  finalizer: AuthTokenFinalizer,
  input: FindUsableAuthTokenInput,
  operation: (admittedFinalizer: AuthTokenFinalizer) => Promise<TResult>,
): Promise<TResult | null> => {
  if (state.validToken(input.tokenHash, input.purpose, input.now) === null
    || state.claimedAuthTokenHashes.has(input.tokenHash)) return null;
  state.claimedAuthTokenHashes.add(input.tokenHash);
  try {
    return await operation(finalizer);
  } finally {
    state.claimedAuthTokenHashes.delete(input.tokenHash);
  }
};

export const verifyEmailAndSetPasswordByToken = (
  state: InMemoryAuthState,
  input: VerifyEmailByTokenInput,
): AccountRecord | null => {
  const token = state.validToken(input.tokenHash, "email_verification", input.now);
  if (token === null) return null;
  const credential = state.accountsById.get(token.accountId);
  if (credential === undefined || credential.account.emailVerifiedAt !== undefined) return null;
  const account = { ...credential.account, emailVerifiedAt: input.now, updatedAt: input.now };
  state.accountsById.set(account.id, { account, passwordHash: input.passwordHash });
  state.authTokensByHash.set(input.tokenHash, { ...token, consumedAt: input.now });
  state.authVersionsByAccountId.set(account.id, (state.authVersionsByAccountId.get(account.id) ?? 1) + 1);
  return account;
};

export const resetPasswordByToken = (
  state: InMemoryAuthState,
  input: ResetPasswordByTokenInput,
): PasswordReplacementResult | null => {
  const token = state.validToken(input.tokenHash, "password_reset", input.now);
  if (token === null) return null;
  const credential = state.accountsById.get(token.accountId);
  if (credential === undefined || credential.account.emailVerifiedAt === undefined) return null;
  state.authTokensByHash.set(input.tokenHash, { ...token, consumedAt: input.now });
  return replacePasswordAndRevokeSessions(state, {
    accountId: token.accountId,
    passwordHash: input.passwordHash,
    now: input.now,
  });
};
