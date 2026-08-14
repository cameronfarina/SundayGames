import type {
  AccountCredentialRecord,
  AccountRecord,
  AuthRepository,
  AuthTokenFinalizer,
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
} from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { createAccount, createOrReplacePendingAccount } from "./accountCreation.js";
import { findAccountById, findAccountCredentialByEmail } from "./accountQueries.js";
import { replacePasswordAndRevokeSessions } from "./passwordReplacement.js";
import { upgradePasswordHash } from "./passwordUpgrade.js";
import { resetPasswordByToken } from "./resetPassword.js";
import { createSession, createSessionForCredential } from "./sessionCreation.js";
import { findSessionById, findSessionByTokenHash, revokeSession } from "./sessionQueries.js";
import { withAuthTokenAdmission } from "./tokenAdmission.js";
import { replaceAuthToken } from "./tokenReplacement.js";
import { verifyEmailAndSetPasswordByToken } from "./verifyEmail.js";

export class PostgresAuthRepository implements AuthRepository {
  readonly #client: PostgresQueryClient;

  constructor(client: PostgresQueryClient) {
    this.#client = client;
  }

  async createAccount(input: CreateAccountRecordInput): Promise<AccountRecord> {
    return await createAccount(this.#client, input);
  }

  async createOrReplacePendingAccount(
    input: CreateOrReplacePendingAccountInput,
  ): Promise<PendingAccountRegistrationResult> {
    return await createOrReplacePendingAccount(this.#client, input);
  }

  async findAccountCredentialByEmail(email: string): Promise<AccountCredentialRecord | null> {
    return await findAccountCredentialByEmail(this.#client, email);
  }

  async findAccountById(accountId: string): Promise<AccountRecord | null> {
    return await findAccountById(this.#client, accountId);
  }

  async createSession(input: CreateSessionRecordInput): Promise<SessionRecord> {
    return await createSession(this.#client, input);
  }

  async createSessionForCredential(
    input: CreateCredentialSessionRecordInput,
  ): Promise<SessionRecord | null> {
    return await createSessionForCredential(this.#client, input);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return await findSessionByTokenHash(this.#client, tokenHash);
  }

  async findSessionById(sessionId: string): Promise<SessionRecord | null> {
    return await findSessionById(this.#client, sessionId);
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<SessionRecord | null> {
    return await revokeSession(this.#client, sessionId, revokedAt);
  }

  async upgradePasswordHash(input: UpgradePasswordHashInput): Promise<AccountCredentialRecord | null> {
    return await upgradePasswordHash(this.#client, input);
  }

  async replacePasswordAndRevokeSessions(
    input: ReplacePasswordInput,
  ): Promise<PasswordReplacementResult | null> {
    return await replacePasswordAndRevokeSessions(this.#client, input);
  }

  async replaceAuthToken(input: ReplaceAuthTokenInput): Promise<AuthTokenRecord | null> {
    return await replaceAuthToken(this.#client, input);
  }

  async withAuthTokenAdmission<TResult>(
    input: FindUsableAuthTokenInput,
    operation: (finalizer: AuthTokenFinalizer) => Promise<TResult>,
  ): Promise<TResult | null> {
    return await withAuthTokenAdmission(
      this.#client,
      input,
      client => new PostgresAuthRepository(client),
      operation,
    );
  }

  async verifyEmailAndSetPasswordByToken(
    input: VerifyEmailByTokenInput,
  ): Promise<AccountRecord | null> {
    return await verifyEmailAndSetPasswordByToken(this.#client, input);
  }

  async resetPasswordByToken(
    input: ResetPasswordByTokenInput,
  ): Promise<PasswordReplacementResult | null> {
    return await resetPasswordByToken(this.#client, input);
  }
}
