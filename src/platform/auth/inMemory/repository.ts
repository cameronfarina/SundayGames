import type { AuthRepository, AuthTokenFinalizer } from "../repositoryContracts.js";
import type {
  AccountCredentialRecord,
  AccountRecord,
  AuthTokenRecord,
  CreateAccountRecordInput,
  CreateCredentialSessionRecordInput,
  CreateOrReplacePendingAccountInput,
  CreateSessionRecordInput,
  FindUsableAuthTokenInput,
  PasswordReplacementResult,
  PendingAccountRegistrationResult,
  ReplaceAuthTokenInput,
  ReplacePasswordInput,
  ResetPasswordByTokenInput,
  SessionRecord,
  UpgradePasswordHashInput,
  VerifyEmailByTokenInput,
} from "../records.js";
import { createAccount, createOrReplacePendingAccount, findAccountById, findAccountCredentialByEmail } from "./accounts.js";
import { replacePasswordAndRevokeSessions, upgradePasswordHash } from "./passwords.js";
import { createSession, createSessionForCredential, findSessionById, findSessionByTokenHash, revokeSession } from "./sessions.js";
import { InMemoryAuthState } from "./state.js";
import { replaceAuthToken, resetPasswordByToken, verifyEmailAndSetPasswordByToken, withAuthTokenAdmission } from "./tokens.js";

export class InMemoryAuthRepository implements AuthRepository {
  readonly #state = new InMemoryAuthState();

  createAccount(input: CreateAccountRecordInput): AccountRecord { return createAccount(this.#state, input); }
  createOrReplacePendingAccount(input: CreateOrReplacePendingAccountInput): PendingAccountRegistrationResult {
    return createOrReplacePendingAccount(this.#state, input);
  }
  findAccountCredentialByEmail(email: string): AccountCredentialRecord | null {
    return findAccountCredentialByEmail(this.#state, email);
  }
  findAccountById(accountId: string): AccountRecord | null { return findAccountById(this.#state, accountId); }
  createSession(input: CreateSessionRecordInput): SessionRecord { return createSession(this.#state, input); }
  async createSessionForCredential(input: CreateCredentialSessionRecordInput): Promise<SessionRecord | null> {
    return createSessionForCredential(this.#state, input);
  }
  findSessionByTokenHash(hash: string): SessionRecord | null { return findSessionByTokenHash(this.#state, hash); }
  findSessionById(sessionId: string): SessionRecord | null { return findSessionById(this.#state, sessionId); }
  revokeSession(sessionId: string, revokedAt: Date): SessionRecord | null {
    return revokeSession(this.#state, sessionId, revokedAt);
  }
  async upgradePasswordHash(input: UpgradePasswordHashInput): Promise<AccountCredentialRecord | null> {
    return upgradePasswordHash(this.#state, input);
  }
  replacePasswordAndRevokeSessions(input: ReplacePasswordInput): PasswordReplacementResult | null {
    return replacePasswordAndRevokeSessions(this.#state, input);
  }
  replaceAuthToken(input: ReplaceAuthTokenInput): AuthTokenRecord | null {
    return replaceAuthToken(this.#state, input);
  }
  async withAuthTokenAdmission<TResult>(
    input: FindUsableAuthTokenInput,
    operation: (finalizer: AuthTokenFinalizer) => Promise<TResult>,
  ): Promise<TResult | null> { return await withAuthTokenAdmission(this.#state, this, input, operation); }
  verifyEmailAndSetPasswordByToken(input: VerifyEmailByTokenInput): AccountRecord | null {
    return verifyEmailAndSetPasswordByToken(this.#state, input);
  }
  resetPasswordByToken(input: ResetPasswordByTokenInput): PasswordReplacementResult | null {
    return resetPasswordByToken(this.#state, input);
  }
  authTokens(): AuthTokenRecord[] { return [...this.#state.authTokensByHash.values()].map(token => ({ ...token })); }
  accounts(): AccountRecord[] { return [...this.#state.accountsById.values()].map(value => value.account); }
  sessions(): SessionRecord[] { return [...this.#state.sessionsById.values()]; }
  clear(): void { this.#state.clear(); }
}
