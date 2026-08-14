import type {
  AccountCredentialRecord,
  AccountRecord,
  PasswordReplacementResult,
  ReplacePasswordInput,
  UpgradePasswordHashInput,
} from "../records.js";
import type { InMemoryAuthState } from "./state.js";

export const upgradePasswordHash = (
  state: InMemoryAuthState,
  input: UpgradePasswordHashInput,
): AccountCredentialRecord | null => {
  const credential = state.accountsById.get(input.accountId);
  if (credential === undefined || credential.passwordHash !== input.expectedPasswordHash) return null;
  const account = { ...credential.account, updatedAt: input.now };
  const upgraded = { account, passwordHash: input.passwordHash };
  state.accountsById.set(input.accountId, upgraded);
  return upgraded;
};

export const replacePasswordAndRevokeSessions = (
  state: InMemoryAuthState,
  input: ReplacePasswordInput,
): PasswordReplacementResult | null => {
  const credential = state.accountsById.get(input.accountId);
  if (
    credential === undefined
    || (input.expectedPasswordHash !== undefined && credential.passwordHash !== input.expectedPasswordHash)
  ) return null;

  const account: AccountRecord = { ...credential.account, updatedAt: input.now };
  state.accountsById.set(input.accountId, { account, passwordHash: input.passwordHash });
  state.authVersionsByAccountId.set(
    input.accountId,
    (state.authVersionsByAccountId.get(input.accountId) ?? 1) + 1,
  );

  let revokedSessionCount = 0;
  for (const [sessionId, session] of state.sessionsById) {
    if (session.accountId !== input.accountId || session.revokedAt !== undefined) continue;
    state.sessionsById.set(sessionId, { ...session, revokedAt: input.now });
    revokedSessionCount += 1;
  }
  return { account, revokedSessionCount };
};
