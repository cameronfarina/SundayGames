import { createHash, randomBytes } from "node:crypto";
import { sameOriginAuthenticationReturnPath } from "./authenticationReturnPath.js";
import {
  consumeUnknownPasswordVerification,
  createPasswordHash,
  createPasswordHashSync,
  passwordHashNeedsRehash,
  passwordValidationIssue,
  verifyPasswordHash,
  verifyPasswordHashSync,
} from "./passwordCrypto.js";

export { passwordHashNeedsRehash } from "./passwordCrypto.js";

export type AuthErrorCode =
  | "auth_required"
  | "duplicate_email"
  | "email_unverified"
  | "invalid_current_password"
  | "invalid_email"
  | "invalid_or_expired_token"
  | "invalid_password"
  | "password_change_conflict"
  | "password_confirmation_mismatch"
  | "password_unchanged";
type MaybePromise<T> = T | Promise<T>;

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

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
  | {
    account: AccountRecord;
    status: "created" | "reissued";
    credentialVersion: number;
  }
  | {
    account: AccountRecord;
    status: "verified";
  };

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

export interface AuthTokenFinalizer {
  verifyEmailAndSetPasswordByToken(input: VerifyEmailByTokenInput): MaybePromise<AccountRecord | null>;
  resetPasswordByToken(input: ResetPasswordByTokenInput): MaybePromise<PasswordReplacementResult | null>;
}

export interface AuthRepository extends AuthTokenFinalizer {
  createAccount(input: CreateAccountRecordInput): MaybePromise<AccountRecord>;
  createOrReplacePendingAccount(input: CreateOrReplacePendingAccountInput): MaybePromise<PendingAccountRegistrationResult>;
  findAccountCredentialByEmail(normalizedEmail: string): MaybePromise<AccountCredentialRecord | null>;
  findAccountById(accountId: string): MaybePromise<AccountRecord | null>;
  createSession(input: CreateSessionRecordInput): MaybePromise<SessionRecord>;
  createSessionForCredential(input: CreateCredentialSessionRecordInput): MaybePromise<SessionRecord | null>;
  findSessionByTokenHash(tokenHash: string): MaybePromise<SessionRecord | null>;
  findSessionById(sessionId: string): MaybePromise<SessionRecord | null>;
  revokeSession(sessionId: string, revokedAt: Date): MaybePromise<SessionRecord | null>;
  upgradePasswordHash(input: UpgradePasswordHashInput): MaybePromise<AccountCredentialRecord | null>;
  replacePasswordAndRevokeSessions(input: ReplacePasswordInput): MaybePromise<PasswordReplacementResult | null>;
  replaceAuthToken(input: ReplaceAuthTokenInput): MaybePromise<AuthTokenRecord | null>;
  withAuthTokenAdmission<TResult>(
    input: FindUsableAuthTokenInput,
    operation: (finalizer: AuthTokenFinalizer) => Promise<TResult>,
  ): MaybePromise<TResult | null>;
}

export interface AuthMailMessage {
  to: string;
  subject: string;
  text: string;
  actionUrl: string;
}

export interface AuthMailSender {
  send(message: AuthMailMessage): Promise<void>;
}

export class CapturingAuthMailSender implements AuthMailSender {
  readonly messages: AuthMailMessage[] = [];

  async send(message: AuthMailMessage): Promise<void> {
    this.messages.push({ ...message });
  }
}

export interface CreateAuthServiceOptions {
  repository: AuthRepository;
  sessionTtlMs?: number | undefined;
  emailVerificationRequired?: boolean | undefined;
  mailSender?: AuthMailSender | undefined;
  publicBaseUrl?: string | undefined;
  verificationTokenTtlMs?: number | undefined;
  passwordResetTokenTtlMs?: number | undefined;
  passwordHasher?: ((password: string) => Promise<string>) | undefined;
}

export interface CreateUserInput {
  email: string;
  password?: string | undefined;
  verificationReturnTo?: string | undefined;
  now?: Date | undefined;
}

export interface LoginInput {
  email: string;
  password: string;
  now?: Date | undefined;
  sessionTtlMs?: number | undefined;
}

export interface LoginResult {
  account: AccountRecord;
  session: SessionRecord;
  sessionToken: string;
}

export interface AuthenticatedSession {
  account: AccountRecord;
  session: SessionRecord;
}

export interface ChangePasswordInput {
  sessionToken: string;
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
  now?: Date | undefined;
}

export interface ResetPasswordInput {
  email: string;
  newPassword: string;
  now?: Date | undefined;
}

export interface VerifyEmailInput {
  token: string;
  newPassword: string;
  newPasswordConfirmation: string;
  now?: Date | undefined;
}

export interface RequestEmailVerificationInput {
  email: string;
  verificationReturnTo?: string | undefined;
  now?: Date | undefined;
}

export interface RequestPasswordResetInput extends RequestEmailVerificationInput {}

export interface ResetPasswordWithTokenInput {
  token: string;
  newPassword: string;
  newPasswordConfirmation: string;
  now?: Date | undefined;
}

export interface AcceptedAuthRequest {
  accepted: true;
}

export interface AuthService {
  createUser(input: CreateUserInput): Promise<AccountRecord>;
  login(input: LoginInput): Promise<LoginResult | null>;
  lookupSession(sessionToken: string, now?: Date): Promise<AuthenticatedSession | null>;
  logout(sessionToken: string, now?: Date): Promise<boolean>;
  revokeSession(sessionId: string, now?: Date): Promise<boolean>;
  changePassword(input: ChangePasswordInput): Promise<PasswordReplacementResult>;
  resetPassword(input: ResetPasswordInput): Promise<PasswordReplacementResult | null>;
  requestEmailVerification(input: RequestEmailVerificationInput): Promise<AcceptedAuthRequest>;
  verifyEmail(input: VerifyEmailInput): Promise<AccountRecord>;
  requestPasswordReset(input: RequestPasswordResetInput): Promise<AcceptedAuthRequest>;
  resetPasswordWithToken(input: ResetPasswordWithTokenInput): Promise<PasswordReplacementResult>;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const defaultSessionTtlMs = 1000 * 60 * 60 * 24 * 30;
const defaultVerificationTokenTtlMs = 1000 * 60 * 60 * 24;
const defaultPasswordResetTokenTtlMs = 1000 * 60 * 30;
const sessionTokenBytes = 32;
const authTokenBytes = 32;
const idBytes = 16;

export const normalizeEmail = (email: string): string => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!emailPattern.test(normalizedEmail)) {
    throw new AuthError("invalid_email", "Enter a valid email address.");
  }

  return normalizedEmail;
};

export const hashPassword = (password: string): string => {
  validatePassword(password);
  return createPasswordHashSync(password);
};

export const verifyPassword = (password: string, storedPasswordHash: string): boolean => {
  return verifyPasswordHashSync(password, storedPasswordHash);
};

export const createSessionToken = (): string => randomBytes(sessionTokenBytes).toString("base64url");

export const hashSessionToken = (sessionToken: string): string =>
  createHash("sha256").update(sessionToken).digest("base64url");

export const hashAuthToken = hashSessionToken;

export class InMemoryAuthRepository implements AuthRepository {
  readonly #accountsById = new Map<string, AccountCredentialRecord>();
  readonly #accountIdsByEmail = new Map<string, string>();
  readonly #sessionsById = new Map<string, SessionRecord>();
  readonly #sessionIdsByTokenHash = new Map<string, string>();
  readonly #authVersionsByAccountId = new Map<string, number>();
  readonly #authVersionsBySessionId = new Map<string, number>();
  readonly #authTokensByHash = new Map<string, AuthTokenRecord>();
  readonly #authVersionsByTokenHash = new Map<string, number>();
  readonly #claimedAuthTokenHashes = new Set<string>();

  createAccount(input: CreateAccountRecordInput): AccountRecord {
    if (this.#accountIdsByEmail.has(input.email)) {
      throw new AuthError("duplicate_email", "An account with this email already exists.");
    }

    const account: AccountRecord = {
      id: input.id,
      email: input.email,
      emailVerifiedAt: input.emailVerifiedAt ?? input.now,
      createdAt: input.now,
      updatedAt: input.now,
    };

    this.#accountsById.set(input.id, {
      account,
      passwordHash: input.passwordHash,
    });
    this.#accountIdsByEmail.set(input.email, input.id);
    this.#authVersionsByAccountId.set(input.id, 1);

    return account;
  }

  createOrReplacePendingAccount(input: CreateOrReplacePendingAccountInput): PendingAccountRegistrationResult {
    const existingId = this.#accountIdsByEmail.get(input.email);
    if (existingId === undefined) {
      const account: AccountRecord = {
        id: input.id,
        email: input.email,
        createdAt: input.now,
        updatedAt: input.now,
      };
      this.#accountsById.set(input.id, { account, passwordHash: input.passwordHash });
      this.#accountIdsByEmail.set(input.email, input.id);
      this.#authVersionsByAccountId.set(input.id, 1);
      return { account, status: "created", credentialVersion: 1 };
    }

    const existing = this.#accountsById.get(existingId);
    if (existing === undefined) throw new Error("Auth email index is inconsistent.");
    if (existing.account.emailVerifiedAt !== undefined) {
      return { account: existing.account, status: "verified" };
    }

    const credentialVersion = (this.#authVersionsByAccountId.get(existingId) ?? 1) + 1;
    const account = { ...existing.account, updatedAt: input.now };
    this.#accountsById.set(existingId, { account, passwordHash: input.passwordHash });
    this.#authVersionsByAccountId.set(existingId, credentialVersion);

    return { account, status: "reissued", credentialVersion };
  }

  findAccountCredentialByEmail(normalizedEmail: string): AccountCredentialRecord | null {
    const accountId = this.#accountIdsByEmail.get(normalizedEmail);

    if (accountId === undefined) {
      return null;
    }

    return this.#accountsById.get(accountId) ?? null;
  }

  findAccountById(accountId: string): AccountRecord | null {
    return this.#accountsById.get(accountId)?.account ?? null;
  }

  createSession(input: CreateSessionRecordInput): SessionRecord {
    const session: SessionRecord = {
      id: input.id,
      accountId: input.accountId,
      tokenHash: input.tokenHash,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      revokedAt: undefined,
    };

    this.#sessionsById.set(input.id, session);
    this.#sessionIdsByTokenHash.set(input.tokenHash, input.id);
    this.#authVersionsBySessionId.set(
      input.id,
      this.#authVersionsByAccountId.get(input.accountId) ?? 1,
    );

    return session;
  }

  async createSessionForCredential(input: CreateCredentialSessionRecordInput): Promise<SessionRecord | null> {
    const credential = this.#accountsById.get(input.accountId);
    if (credential === undefined || credential.passwordHash !== input.expectedPasswordHash) return null;

    return this.createSession(input);
  }

  findSessionByTokenHash(tokenHash: string): SessionRecord | null {
    const sessionId = this.#sessionIdsByTokenHash.get(tokenHash);

    if (sessionId === undefined) {
      return null;
    }

    const session = this.#sessionsById.get(sessionId);
    if (session === undefined) return null;
    if (this.#authVersionsBySessionId.get(sessionId) !== this.#authVersionsByAccountId.get(session.accountId)) {
      return null;
    }

    return session;
  }

  findSessionById(sessionId: string): SessionRecord | null {
    return this.#sessionsById.get(sessionId) ?? null;
  }

  revokeSession(sessionId: string, revokedAt: Date): SessionRecord | null {
    const session = this.#sessionsById.get(sessionId);

    if (session === undefined) {
      return null;
    }

    const revokedSession: SessionRecord = {
      ...session,
      revokedAt,
    };

    this.#sessionsById.set(sessionId, revokedSession);
    return revokedSession;
  }

  async upgradePasswordHash(input: UpgradePasswordHashInput): Promise<AccountCredentialRecord | null> {
    const credential = this.#accountsById.get(input.accountId);
    if (credential === undefined || credential.passwordHash !== input.expectedPasswordHash) return null;
    const account = { ...credential.account, updatedAt: input.now };
    const upgraded = { account, passwordHash: input.passwordHash };
    this.#accountsById.set(input.accountId, upgraded);
    return upgraded;
  }

  replacePasswordAndRevokeSessions(input: ReplacePasswordInput): PasswordReplacementResult | null {
    const credential = this.#accountsById.get(input.accountId);
    if (
      credential === undefined ||
      (input.expectedPasswordHash !== undefined && credential.passwordHash !== input.expectedPasswordHash)
    ) {
      return null;
    }

    const account: AccountRecord = {
      ...credential.account,
      updatedAt: input.now,
    };
    this.#accountsById.set(input.accountId, {
      account,
      passwordHash: input.passwordHash,
    });
    this.#authVersionsByAccountId.set(
      input.accountId,
      (this.#authVersionsByAccountId.get(input.accountId) ?? 1) + 1,
    );

    let revokedSessionCount = 0;
    for (const [sessionId, session] of this.#sessionsById) {
      if (session.accountId !== input.accountId || session.revokedAt !== undefined) continue;
      this.#sessionsById.set(sessionId, { ...session, revokedAt: input.now });
      revokedSessionCount += 1;
    }

    return { account, revokedSessionCount };
  }

  replaceAuthToken(input: ReplaceAuthTokenInput): AuthTokenRecord | null {
    const credentialVersion = this.#authVersionsByAccountId.get(input.accountId);
    if (
      credentialVersion === undefined ||
      (input.expectedCredentialVersion !== undefined &&
        input.expectedCredentialVersion !== credentialVersion)
    ) {
      return null;
    }
    for (const [tokenHash, token] of this.#authTokensByHash) {
      if (token.accountId === input.accountId && token.purpose === input.purpose && token.consumedAt === undefined) {
        this.#authTokensByHash.set(tokenHash, { ...token, consumedAt: input.createdAt });
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
    this.#authTokensByHash.set(input.tokenHash, token);
    this.#authVersionsByTokenHash.set(input.tokenHash, credentialVersion);
    return token;
  }

  async withAuthTokenAdmission<TResult>(
    input: FindUsableAuthTokenInput,
    operation: (finalizer: AuthTokenFinalizer) => Promise<TResult>,
  ): Promise<TResult | null> {
    if (
      this.#validToken(input.tokenHash, input.purpose, input.now) === null ||
      this.#claimedAuthTokenHashes.has(input.tokenHash)
    ) {
      return null;
    }
    this.#claimedAuthTokenHashes.add(input.tokenHash);
    try {
      return await operation(this);
    } finally {
      this.#claimedAuthTokenHashes.delete(input.tokenHash);
    }
  }

  verifyEmailAndSetPasswordByToken(input: VerifyEmailByTokenInput): AccountRecord | null {
    const token = this.#validToken(input.tokenHash, "email_verification", input.now);
    if (token === null) return null;
    const credential = this.#accountsById.get(token.accountId);
    if (credential === undefined || credential.account.emailVerifiedAt !== undefined) return null;
    const account = { ...credential.account, emailVerifiedAt: input.now, updatedAt: input.now };
    this.#accountsById.set(account.id, { account, passwordHash: input.passwordHash });
    this.#authTokensByHash.set(input.tokenHash, { ...token, consumedAt: input.now });
    this.#authVersionsByAccountId.set(
      account.id,
      (this.#authVersionsByAccountId.get(account.id) ?? 1) + 1,
    );
    return account;
  }

  resetPasswordByToken(input: ResetPasswordByTokenInput): PasswordReplacementResult | null {
    const token = this.#validToken(input.tokenHash, "password_reset", input.now);
    if (token === null) return null;
    const credential = this.#accountsById.get(token.accountId);
    if (credential === undefined || credential.account.emailVerifiedAt === undefined) return null;
    this.#authTokensByHash.set(input.tokenHash, { ...token, consumedAt: input.now });
    return this.replacePasswordAndRevokeSessions({
      accountId: token.accountId,
      passwordHash: input.passwordHash,
      now: input.now,
    });
  }

  authTokens(): AuthTokenRecord[] {
    return [...this.#authTokensByHash.values()].map(token => ({ ...token }));
  }

  #validToken(tokenHash: string, purpose: AuthTokenPurpose, now: Date): AuthTokenRecord | null {
    const token = this.#authTokensByHash.get(tokenHash);
    return token !== undefined &&
        this.#authVersionsByTokenHash.get(tokenHash) === this.#authVersionsByAccountId.get(token.accountId) &&
        token.purpose === purpose && token.consumedAt === undefined && token.expiresAt > now
      ? token
      : null;
  }

  accounts(): AccountRecord[] {
    return [...this.#accountsById.values()].map(({ account }) => account);
  }

  sessions(): SessionRecord[] {
    return [...this.#sessionsById.values()];
  }

  clear(): void {
    this.#accountsById.clear();
    this.#accountIdsByEmail.clear();
    this.#sessionsById.clear();
    this.#sessionIdsByTokenHash.clear();
    this.#authVersionsByAccountId.clear();
    this.#authVersionsBySessionId.clear();
    this.#authTokensByHash.clear();
    this.#authVersionsByTokenHash.clear();
    this.#claimedAuthTokenHashes.clear();
  }
}

export const createAuthService = ({
  repository,
  sessionTtlMs = defaultSessionTtlMs,
  emailVerificationRequired = false,
  mailSender,
  publicBaseUrl,
  verificationTokenTtlMs = defaultVerificationTokenTtlMs,
  passwordResetTokenTtlMs = defaultPasswordResetTokenTtlMs,
  passwordHasher = hashServicePassword,
}: CreateAuthServiceOptions): AuthService => ({
  createUser: async ({ email, password, verificationReturnTo, now = new Date() }) => {
    const normalizedEmail = normalizeEmail(email);
    if (!emailVerificationRequired) {
      if (password === undefined) {
        throw new AuthError("invalid_password", "Password is required.");
      }
      validatePassword(password);
      const passwordHash = await passwordHasher(password);
      return await repository.createAccount({
        id: createId("acct"),
        email: normalizedEmail,
        passwordHash,
        emailVerifiedAt: now,
        now,
      });
    }
    const passwordHash = await createPendingPasswordHash(passwordHasher);
    const registration = await repository.createOrReplacePendingAccount({
      id: createId("acct"),
      email: normalizedEmail,
      passwordHash,
      now,
    });
    if (registration.status !== "verified") {
      await sendAuthAction({
        repository,
        mailSender,
        publicBaseUrl,
        account: registration.account,
        purpose: "email_verification",
        returnTo: verificationReturnTo,
        now,
        ttlMs: verificationTokenTtlMs,
        expectedCredentialVersion: registration.credentialVersion,
      });
    }
    return registration.account;
  },

  login: async ({ email, password, now = new Date(), sessionTtlMs: loginSessionTtlMs }) => {
    validatePassword(password);
    const normalizedEmail = normalizeEmail(email);
    let credential = await repository.findAccountCredentialByEmail(normalizedEmail);

    if (credential === null) {
      await consumeUnknownPasswordVerification(password);
      return null;
    }

    if (!(await verifyServicePassword(password, credential.passwordHash))) {
      return null;
    }
    if (credential.account.emailVerifiedAt === undefined) {
      throw new AuthError(
        "email_unverified",
        "Verify your email before signing in. We can send you a new verification link.",
      );
    }
    if (passwordHashNeedsRehash(credential.passwordHash)) {
      const passwordHash = await passwordHasher(password);
      const upgraded = await repository.upgradePasswordHash({
        accountId: credential.account.id,
        expectedPasswordHash: credential.passwordHash,
        passwordHash,
        now,
      });
      if (upgraded === null) {
        const refreshedCredential = await repository.findAccountCredentialByEmail(normalizedEmail);
        if (
          refreshedCredential === null
          || !(await verifyServicePassword(password, refreshedCredential.passwordHash))
        ) {
          return null;
        }
        credential = refreshedCredential;
      } else {
        credential = upgraded;
      }
    }

    const sessionToken = createSessionToken();
    const expiresAt = new Date(now.getTime() + (loginSessionTtlMs ?? sessionTtlMs));
    const session = await repository.createSessionForCredential({
      id: createId("sess"),
      accountId: credential.account.id,
      expectedPasswordHash: credential.passwordHash,
      tokenHash: hashSessionToken(sessionToken),
      createdAt: now,
      expiresAt,
    });
    if (session === null) return null;

    return {
      account: credential.account,
      session,
      sessionToken,
    };
  },

  lookupSession: async (sessionToken, now = new Date()) => {
    const session = await repository.findSessionByTokenHash(hashSessionToken(sessionToken));

    if (session === null || session.revokedAt !== undefined || session.expiresAt <= now) {
      return null;
    }

    const account = await repository.findAccountById(session.accountId);

    if (account === null) {
      return null;
    }

    return {
      account,
      session,
    };
  },

  logout: async (sessionToken, now = new Date()) => {
    const session = await repository.findSessionByTokenHash(hashSessionToken(sessionToken));

    if (session === null) {
      return false;
    }

    return await repository.revokeSession(session.id, now) !== null;
  },

  revokeSession: async (sessionId, now = new Date()) => await repository.revokeSession(sessionId, now) !== null,

  changePassword: async ({
    sessionToken,
    currentPassword,
    newPassword,
    newPasswordConfirmation,
    now = new Date(),
  }) => {
    const authenticated = await findAuthenticatedSession(repository, sessionToken, now);
    if (authenticated === null) {
      throw new AuthError("auth_required", "Sign in before changing your password.");
    }

    const credential = await repository.findAccountCredentialByEmail(authenticated.account.email);
    if (credential === null) {
      throw new AuthError("auth_required", "Sign in before changing your password.");
    }
    validatePassword(currentPassword);
    if (!(await verifyServicePassword(currentPassword, credential.passwordHash))) {
      throw new AuthError("invalid_current_password", "Current password is incorrect.");
    }
    if (newPassword !== newPasswordConfirmation) {
      throw new AuthError("password_confirmation_mismatch", "New passwords do not match.");
    }
    validatePassword(newPassword);
    if (await verifyServicePassword(newPassword, credential.passwordHash)) {
      throw new AuthError("password_unchanged", "Choose a password you have not already used.");
    }

    const passwordHash = await passwordHasher(newPassword);
    const result = await repository.replacePasswordAndRevokeSessions({
      accountId: authenticated.account.id,
      expectedPasswordHash: credential.passwordHash,
      passwordHash,
      now,
    });
    if (result === null) {
      throw new AuthError(
        "password_change_conflict",
        "Your password changed in another session. Sign in and try again.",
      );
    }

    return result;
  },

  resetPassword: async ({ email, newPassword, now = new Date() }) => {
    validatePassword(newPassword);
    const normalizedEmail = normalizeEmail(email);
    const credential = await repository.findAccountCredentialByEmail(normalizedEmail);
    if (credential === null) return null;
    const passwordHash = await passwordHasher(newPassword);

    return await repository.replacePasswordAndRevokeSessions({
      accountId: credential.account.id,
      passwordHash,
      now,
    });
  },

  requestEmailVerification: async ({ email, verificationReturnTo, now = new Date() }) => {
    const normalizedEmail = normalizeEmail(email);
    const credential = await repository.findAccountCredentialByEmail(normalizedEmail);
    if (credential !== null && credential.account.emailVerifiedAt === undefined) {
      await sendAuthAction({
        repository,
        mailSender,
        publicBaseUrl,
        account: credential.account,
        purpose: "email_verification",
        returnTo: verificationReturnTo,
        now,
        ttlMs: verificationTokenTtlMs,
      });
    }
    return { accepted: true };
  },

  verifyEmail: async ({ token, newPassword, newPasswordConfirmation, now = new Date() }) => {
    if (newPassword !== newPasswordConfirmation) {
      throw new AuthError("password_confirmation_mismatch", "New passwords do not match.");
    }
    validatePassword(newPassword);
    const tokenHash = hashAuthToken(token);
    const account = await repository.withAuthTokenAdmission({
      tokenHash,
      purpose: "email_verification",
      now,
    }, async finalizer => {
      const passwordHash = await passwordHasher(newPassword);
      return await finalizer.verifyEmailAndSetPasswordByToken({ tokenHash, passwordHash, now });
    });
    if (account === null) {
      throw new AuthError("invalid_or_expired_token", "This link is invalid or has expired.");
    }
    return account;
  },

  requestPasswordReset: async ({ email, now = new Date() }) => {
    const normalizedEmail = normalizeEmail(email);
    const credential = await repository.findAccountCredentialByEmail(normalizedEmail);
    if (credential !== null && credential.account.emailVerifiedAt !== undefined) {
      await sendAuthAction({
        repository,
        mailSender,
        publicBaseUrl,
        account: credential.account,
        purpose: "password_reset",
        now,
        ttlMs: passwordResetTokenTtlMs,
      });
    }
    return { accepted: true };
  },

  resetPasswordWithToken: async ({
    token,
    newPassword,
    newPasswordConfirmation,
    now = new Date(),
  }) => {
    if (newPassword !== newPasswordConfirmation) {
      throw new AuthError("password_confirmation_mismatch", "New passwords do not match.");
    }
    validatePassword(newPassword);
    const tokenHash = hashAuthToken(token);
    const result = await repository.withAuthTokenAdmission({
      tokenHash,
      purpose: "password_reset",
      now,
    }, async finalizer => {
      const passwordHash = await passwordHasher(newPassword);
      return await finalizer.resetPasswordByToken({ tokenHash, passwordHash, now });
    });
    if (result === null) {
      throw new AuthError("invalid_or_expired_token", "This link is invalid or has expired.");
    }
    return result;
  },
});

interface SendAuthActionInput {
  repository: AuthRepository;
  mailSender: AuthMailSender | undefined;
  publicBaseUrl: string | undefined;
  account: AccountRecord;
  purpose: AuthTokenPurpose;
  returnTo?: string | undefined;
  now: Date;
  ttlMs: number;
  expectedCredentialVersion?: number | undefined;
}

const sendAuthAction = async (input: SendAuthActionInput): Promise<void> => {
  if (input.mailSender === undefined || input.publicBaseUrl === undefined) {
    throw new Error("Auth mail delivery and public base URL must be configured.");
  }
  const rawToken = randomBytes(authTokenBytes).toString("base64url");
  const storedToken = await input.repository.replaceAuthToken({
    id: createId("auth"),
    accountId: input.account.id,
    purpose: input.purpose,
    tokenHash: hashAuthToken(rawToken),
    createdAt: input.now,
    expiresAt: new Date(input.now.getTime() + input.ttlMs),
    expectedCredentialVersion: input.expectedCredentialVersion,
  });
  if (storedToken === null) return;
  const route = input.purpose === "email_verification" ? "/verify-email" : "/reset-password";
  const actionUrl = new URL(route, input.publicBaseUrl);
  actionUrl.searchParams.set("token", rawToken);
  const returnTo = sameOriginAuthenticationReturnPath(input.returnTo, input.publicBaseUrl);
  if (returnTo !== undefined) actionUrl.searchParams.set("returnTo", returnTo);
  const verification = input.purpose === "email_verification";
  await input.mailSender.send({
    to: input.account.email,
    subject: verification ? "Finish your Mockd account" : "Reset your Mockd password",
    text: verification
      ? `Verify your email and choose your Mockd password: ${actionUrl.toString()}`
      : `Reset your Mockd password: ${actionUrl.toString()}`,
    actionUrl: actionUrl.toString(),
  });
};

const findAuthenticatedSession = async (
  repository: AuthRepository,
  sessionToken: string,
  now: Date,
): Promise<AuthenticatedSession | null> => {
  const session = await repository.findSessionByTokenHash(hashSessionToken(sessionToken));
  if (session === null || session.revokedAt !== undefined || session.expiresAt <= now) return null;
  const account = await repository.findAccountById(session.accountId);

  return account === null ? null : { account, session };
};

const hashServicePassword = async (password: string): Promise<string> => {
  validatePassword(password);
  return await createPasswordHash(password);
};

const createPendingPasswordHash = async (
  passwordHasher: (password: string) => Promise<string>,
): Promise<string> => await passwordHasher(randomBytes(32).toString("base64url"));

const verifyServicePassword = async (password: string, storedPasswordHash: string): Promise<boolean> => {
  return await verifyPasswordHash(password, storedPasswordHash);
};

const validatePassword = (password: string): void => {
  const issue = passwordValidationIssue(password);
  if (issue === "too_short") {
    throw new AuthError("invalid_password", "Password must be at least 8 characters.");
  }
  if (issue === "too_long") {
    throw new AuthError("invalid_password", "Password must be no more than 1024 UTF-8 bytes.");
  }
};

const createId = (prefix: "acct" | "auth" | "sess"): string =>
  `${prefix}_${randomBytes(idBytes).toString("base64url")}`;
