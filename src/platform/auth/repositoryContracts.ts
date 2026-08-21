import type {
  AccountCredentialRecord,
  AccountRecord,
  AuthTokenRecord,
  CreateAccountRecordInput,
  CreateCredentialSessionRecordInput,
  CreatePendingAccountInput,
  CreateSessionRecordInput,
  FindUsableAuthTokenInput,
  PasswordReplacementResult,
  PendingAccountRegistrationResult,
  ReplaceAuthTokenInput,
  ReplaceDisplayNameInput,
  ReplacePasswordInput,
  ResetPasswordByTokenInput,
  SessionRecord,
  UpgradePasswordHashInput,
  VerifyEmailByTokenInput,
} from "./records.js";

type MaybePromise<T> = T | Promise<T>;

export interface AuthTokenFinalizer {
  verifyEmailAndSetPasswordByToken(input: VerifyEmailByTokenInput): MaybePromise<AccountRecord | null>;
  resetPasswordByToken(input: ResetPasswordByTokenInput): MaybePromise<PasswordReplacementResult | null>;
}

export interface AuthRepository extends AuthTokenFinalizer {
  createAccount(input: CreateAccountRecordInput): MaybePromise<AccountRecord>;
  createPendingAccount(input: CreatePendingAccountInput): MaybePromise<PendingAccountRegistrationResult>;
  findAccountCredentialByEmail(normalizedEmail: string): MaybePromise<AccountCredentialRecord | null>;
  findAccountById(accountId: string): MaybePromise<AccountRecord | null>;
  createSession(input: CreateSessionRecordInput): MaybePromise<SessionRecord>;
  createSessionForCredential(input: CreateCredentialSessionRecordInput): MaybePromise<SessionRecord | null>;
  findSessionByTokenHash(tokenHash: string): MaybePromise<SessionRecord | null>;
  findSessionById(sessionId: string): MaybePromise<SessionRecord | null>;
  revokeSession(sessionId: string, revokedAt: Date): MaybePromise<SessionRecord | null>;
  upgradePasswordHash(input: UpgradePasswordHashInput): MaybePromise<AccountCredentialRecord | null>;
  replacePasswordAndRevokeSessions(input: ReplacePasswordInput): MaybePromise<PasswordReplacementResult | null>;
  replaceDisplayName(input: ReplaceDisplayNameInput): MaybePromise<AccountRecord | null>;
  replaceAuthToken(input: ReplaceAuthTokenInput): MaybePromise<AuthTokenRecord | null>;
  withAuthTokenAdmission<TResult>(
    input: FindUsableAuthTokenInput,
    operation: (finalizer: AuthTokenFinalizer) => Promise<TResult>,
  ): MaybePromise<TResult | null>;
}
