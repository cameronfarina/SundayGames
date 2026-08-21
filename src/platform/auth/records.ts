export interface AccountRecord {
  id: string;
  email: string;
  displayName?: string | undefined;
  emailVerifiedAt?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export type AuthTokenPurpose = "email_verification" | "password_reset";

export interface AuthTokenRecord {
  id: string;
  accountId: string;
  purpose: AuthTokenPurpose;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | undefined;
}

export interface SessionRecord {
  id: string;
  accountId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | undefined;
}

export interface AccountCredentialRecord {
  account: AccountRecord;
  passwordHash: string;
}

export interface CreateAccountRecordInput {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt?: Date | undefined;
  now: Date;
}

export interface CreatePendingAccountInput extends CreateAccountRecordInput {}

export type PendingAccountRegistrationResult =
  | { account: AccountRecord; status: "created"; credentialVersion: number }
  | { account: AccountRecord; status: "existing" };

export interface ReplaceAuthTokenInput {
  id: string;
  accountId: string;
  purpose: AuthTokenPurpose;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  expectedCredentialVersion?: number | undefined;
}

export interface ConsumeAuthTokenInput {
  tokenHash: string;
  now: Date;
}

export interface VerifyEmailByTokenInput extends ConsumeAuthTokenInput {
  passwordHash: string;
}

export interface FindUsableAuthTokenInput extends ConsumeAuthTokenInput {
  purpose: AuthTokenPurpose;
}

export interface ResetPasswordByTokenInput extends ConsumeAuthTokenInput {
  passwordHash: string;
}

export interface CreateSessionRecordInput {
  id: string;
  accountId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface CreateCredentialSessionRecordInput extends CreateSessionRecordInput {
  expectedPasswordHash: string;
}

export interface ReplacePasswordInput {
  accountId: string;
  expectedPasswordHash?: string | undefined;
  passwordHash: string;
  now: Date;
}

/** An absent display name clears the stored one and falls back to the email. */
export interface ReplaceDisplayNameInput {
  accountId: string;
  displayName: string | undefined;
  now: Date;
}

export interface UpgradePasswordHashInput {
  accountId: string;
  expectedPasswordHash: string;
  passwordHash: string;
  now: Date;
}

export interface PasswordReplacementResult {
  account: AccountRecord;
  revokedSessionCount: number;
}
