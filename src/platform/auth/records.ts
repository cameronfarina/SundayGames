export interface AccountRecord {
  id: string;
  email: string;
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

export interface CreateOrReplacePendingAccountInput extends CreateAccountRecordInput {}

export type PendingAccountRegistrationResult =
  | { account: AccountRecord; status: "created" | "reissued"; credentialVersion: number }
  | { account: AccountRecord; status: "verified" };

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
