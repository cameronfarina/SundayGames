import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { sameOriginAuthenticationReturnPath } from "./authenticationReturnPath.js";

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

export interface PendingAccountRegistrationResult {
  account: AccountRecord;
  status: "created" | "reissued" | "verified";
}

export interface ReplaceAuthTokenInput {
  id: string;
  accountId: string;
  purpose: AuthTokenPurpose;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ConsumeAuthTokenInput {
  tokenHash: string;
  now: Date;
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

export interface PasswordReplacementResult {
  account: AccountRecord;
  revokedSessionCount: number;
}

export interface AuthRepository {
  createAccount(input: CreateAccountRecordInput): MaybePromise<AccountRecord>;
  createOrReplacePendingAccount(input: CreateOrReplacePendingAccountInput): MaybePromise<PendingAccountRegistrationResult>;
  findAccountCredentialByEmail(normalizedEmail: string): MaybePromise<AccountCredentialRecord | null>;
  findAccountById(accountId: string): MaybePromise<AccountRecord | null>;
  createSession(input: CreateSessionRecordInput): MaybePromise<SessionRecord>;
  createSessionForCredential(input: CreateCredentialSessionRecordInput): MaybePromise<SessionRecord | null>;
  findSessionByTokenHash(tokenHash: string): MaybePromise<SessionRecord | null>;
  findSessionById(sessionId: string): MaybePromise<SessionRecord | null>;
  revokeSession(sessionId: string, revokedAt: Date): MaybePromise<SessionRecord | null>;
  replacePasswordAndRevokeSessions(input: ReplacePasswordInput): MaybePromise<PasswordReplacementResult | null>;
  replaceAuthToken(input: ReplaceAuthTokenInput): MaybePromise<AuthTokenRecord>;
  hasUsableAuthToken(input: FindUsableAuthTokenInput): MaybePromise<boolean>;
  verifyEmailByToken(input: ConsumeAuthTokenInput): MaybePromise<AccountRecord | null>;
  resetPasswordByToken(input: ResetPasswordByTokenInput): MaybePromise<PasswordReplacementResult | null>;
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
}

export interface CreateUserInput {
  email: string;
  password: string;
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
const passwordSaltBytes = 16;
const minimumPasswordLength = 8;
const unknownAccountPasswordSalt = Buffer.alloc(passwordSaltBytes).toString("base64url");
const passwordKeyBytes = 64;
const scryptCost = 16_384;
const scryptBlockSize = 8;
const scryptParallelization = 1;
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

  const salt = randomBytes(passwordSaltBytes).toString("base64url");
  const derivedKey = derivePasswordKeySync(password, salt);

  return formatPasswordHash(salt, derivedKey);
};

export const verifyPassword = (password: string, storedPasswordHash: string): boolean => {
  const parsedHash = parsePasswordHash(storedPasswordHash);

  if (parsedHash === null) {
    return false;
  }

  const derivedKey = derivePasswordKeySync(password, parsedHash.salt);
  return passwordKeysMatch(derivedKey, parsedHash.derivedKey);
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
      return { account, status: "created" };
    }

    const existing = this.#accountsById.get(existingId);
    if (existing === undefined) throw new Error("Auth email index is inconsistent.");
    if (existing.account.emailVerifiedAt !== undefined) {
      return { account: existing.account, status: "verified" };
    }

    return { account: existing.account, status: "reissued" };
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

  replaceAuthToken(input: ReplaceAuthTokenInput): AuthTokenRecord {
    for (const [tokenHash, token] of this.#authTokensByHash) {
      if (token.accountId === input.accountId && token.purpose === input.purpose && token.consumedAt === undefined) {
        this.#authTokensByHash.set(tokenHash, { ...token, consumedAt: input.createdAt });
      }
    }
    const token: AuthTokenRecord = { ...input, consumedAt: undefined };
    this.#authTokensByHash.set(input.tokenHash, token);
    return token;
  }

  hasUsableAuthToken(input: FindUsableAuthTokenInput): boolean {
    return this.#validToken(input.tokenHash, input.purpose, input.now) !== null;
  }

  verifyEmailByToken(input: ConsumeAuthTokenInput): AccountRecord | null {
    const token = this.#validToken(input.tokenHash, "email_verification", input.now);
    if (token === null) return null;
    const credential = this.#accountsById.get(token.accountId);
    if (credential === undefined || credential.account.emailVerifiedAt !== undefined) return null;
    const account = { ...credential.account, emailVerifiedAt: input.now, updatedAt: input.now };
    this.#accountsById.set(account.id, { ...credential, account });
    this.#authTokensByHash.set(input.tokenHash, { ...token, consumedAt: input.now });
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
    return token !== undefined && token.purpose === purpose && token.consumedAt === undefined && token.expiresAt > now
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
}: CreateAuthServiceOptions): AuthService => ({
  createUser: async ({ email, password, verificationReturnTo, now = new Date() }) => {
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await hashServicePassword(password);
    if (!emailVerificationRequired) {
      return await repository.createAccount({
        id: createId("acct"),
        email: normalizedEmail,
        passwordHash,
        emailVerifiedAt: now,
        now,
      });
    }
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
      });
    }
    return registration.account;
  },

  login: async ({ email, password, now = new Date(), sessionTtlMs: loginSessionTtlMs }) => {
    const normalizedEmail = normalizeEmail(email);
    const credential = await repository.findAccountCredentialByEmail(normalizedEmail);

    if (credential === null) {
      await derivePasswordKeyAsync(password, unknownAccountPasswordSalt);
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

    const passwordHash = await hashServicePassword(newPassword);
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
    const normalizedEmail = normalizeEmail(email);
    const credential = await repository.findAccountCredentialByEmail(normalizedEmail);
    if (credential === null) return null;
    const passwordHash = await hashServicePassword(newPassword);

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

  verifyEmail: async ({ token, now = new Date() }) => {
    const account = await repository.verifyEmailByToken({ tokenHash: hashAuthToken(token), now });
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
    if (!await repository.hasUsableAuthToken({
      tokenHash,
      purpose: "password_reset",
      now,
    })) {
      throw new AuthError("invalid_or_expired_token", "This link is invalid or has expired.");
    }
    const passwordHash = await hashServicePassword(newPassword);
    const result = await repository.resetPasswordByToken({
      tokenHash,
      passwordHash,
      now,
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
}

const sendAuthAction = async (input: SendAuthActionInput): Promise<void> => {
  if (input.mailSender === undefined || input.publicBaseUrl === undefined) {
    throw new Error("Auth mail delivery and public base URL must be configured.");
  }
  const rawToken = randomBytes(authTokenBytes).toString("base64url");
  await input.repository.replaceAuthToken({
    id: createId("auth"),
    accountId: input.account.id,
    purpose: input.purpose,
    tokenHash: hashAuthToken(rawToken),
    createdAt: input.now,
    expiresAt: new Date(input.now.getTime() + input.ttlMs),
  });
  const route = input.purpose === "email_verification" ? "/verify-email" : "/reset-password";
  const actionUrl = new URL(route, input.publicBaseUrl);
  actionUrl.searchParams.set("token", rawToken);
  const returnTo = sameOriginAuthenticationReturnPath(input.returnTo, input.publicBaseUrl);
  if (returnTo !== undefined) actionUrl.searchParams.set("returnTo", returnTo);
  const verification = input.purpose === "email_verification";
  await input.mailSender.send({
    to: input.account.email,
    subject: verification ? "Verify your Mockd email" : "Reset your Mockd password",
    text: verification
      ? `Verify your Mockd email: ${actionUrl.toString()}`
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

  const salt = randomBytes(passwordSaltBytes).toString("base64url");
  const derivedKey = await derivePasswordKeyAsync(password, salt);

  return formatPasswordHash(salt, derivedKey);
};

const verifyServicePassword = async (password: string, storedPasswordHash: string): Promise<boolean> => {
  const parsedHash = parsePasswordHash(storedPasswordHash);

  if (parsedHash === null) {
    return false;
  }

  const derivedKey = await derivePasswordKeyAsync(password, parsedHash.salt);
  return passwordKeysMatch(derivedKey, parsedHash.derivedKey);
};

const validatePassword = (password: string): void => {
  if (password.length < minimumPasswordLength) {
    throw new AuthError("invalid_password", "Password must be at least 8 characters.");
  }
};

const formatPasswordHash = (salt: string, derivedKey: string): string => [
  "scrypt",
  String(scryptCost),
  String(scryptBlockSize),
  String(scryptParallelization),
  salt,
  derivedKey,
].join("$");

const passwordKeysMatch = (candidateKey: string, storedKey: string): boolean => {
  const candidateKeyBuffer = Buffer.from(candidateKey, "base64url");
  const storedKeyBuffer = Buffer.from(storedKey, "base64url");

  return candidateKeyBuffer.length === storedKeyBuffer.length
    && timingSafeEqual(candidateKeyBuffer, storedKeyBuffer);
};

const derivePasswordKeyAsync = (password: string, salt: string): Promise<string> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, passwordKeyBytes, {
      N: scryptCost,
      r: scryptBlockSize,
      p: scryptParallelization,
    }, (error, derivedKey) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(derivedKey.toString("base64url"));
    });
  });

const derivePasswordKeySync = (password: string, salt: string): string =>
  scryptSync(password, salt, passwordKeyBytes, {
    N: scryptCost,
    r: scryptBlockSize,
    p: scryptParallelization,
  }).toString("base64url");

interface ParsedPasswordHash {
  salt: string;
  derivedKey: string;
}

const parsePasswordHash = (storedPasswordHash: string): ParsedPasswordHash | null => {
  const [algorithm, cost, blockSize, parallelization, salt, derivedKey] = storedPasswordHash.split("$");

  if (
    algorithm !== "scrypt" ||
    cost !== String(scryptCost) ||
    blockSize !== String(scryptBlockSize) ||
    parallelization !== String(scryptParallelization) ||
    salt === undefined ||
    derivedKey === undefined
  ) {
    return null;
  }

  return {
    salt,
    derivedKey,
  };
};

const createId = (prefix: "acct" | "auth" | "sess"): string =>
  `${prefix}_${randomBytes(idBytes).toString("base64url")}`;
