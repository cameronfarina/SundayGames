import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

export type AuthErrorCode =
  | "auth_required"
  | "duplicate_email"
  | "invalid_current_password"
  | "invalid_email"
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
  createdAt: Date;
  updatedAt: Date;
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
  now: Date;
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
  findAccountCredentialByEmail(normalizedEmail: string): MaybePromise<AccountCredentialRecord | null>;
  findAccountById(accountId: string): MaybePromise<AccountRecord | null>;
  createSession(input: CreateSessionRecordInput): MaybePromise<SessionRecord>;
  createSessionForCredential(input: CreateCredentialSessionRecordInput): MaybePromise<SessionRecord | null>;
  findSessionByTokenHash(tokenHash: string): MaybePromise<SessionRecord | null>;
  findSessionById(sessionId: string): MaybePromise<SessionRecord | null>;
  revokeSession(sessionId: string, revokedAt: Date): MaybePromise<SessionRecord | null>;
  replacePasswordAndRevokeSessions(input: ReplacePasswordInput): MaybePromise<PasswordReplacementResult | null>;
}

export interface CreateAuthServiceOptions {
  repository: AuthRepository;
  sessionTtlMs?: number | undefined;
}

export interface CreateUserInput {
  email: string;
  password: string;
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

export interface AuthService {
  createUser(input: CreateUserInput): Promise<AccountRecord>;
  login(input: LoginInput): Promise<LoginResult | null>;
  lookupSession(sessionToken: string, now?: Date): Promise<AuthenticatedSession | null>;
  logout(sessionToken: string, now?: Date): Promise<boolean>;
  revokeSession(sessionId: string, now?: Date): Promise<boolean>;
  changePassword(input: ChangePasswordInput): Promise<PasswordReplacementResult>;
  resetPassword(input: ResetPasswordInput): Promise<PasswordReplacementResult | null>;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const defaultSessionTtlMs = 1000 * 60 * 60 * 24 * 30;
const passwordSaltBytes = 16;
const minimumPasswordLength = 8;
const unknownAccountPasswordSalt = Buffer.alloc(passwordSaltBytes).toString("base64url");
const passwordKeyBytes = 64;
const scryptCost = 16_384;
const scryptBlockSize = 8;
const scryptParallelization = 1;
const sessionTokenBytes = 32;
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

export class InMemoryAuthRepository implements AuthRepository {
  readonly #accountsById = new Map<string, AccountCredentialRecord>();
  readonly #accountIdsByEmail = new Map<string, string>();
  readonly #sessionsById = new Map<string, SessionRecord>();
  readonly #sessionIdsByTokenHash = new Map<string, string>();
  readonly #authVersionsByAccountId = new Map<string, number>();
  readonly #authVersionsBySessionId = new Map<string, number>();

  createAccount(input: CreateAccountRecordInput): AccountRecord {
    if (this.#accountIdsByEmail.has(input.email)) {
      throw new AuthError("duplicate_email", "An account with this email already exists.");
    }

    const account: AccountRecord = {
      id: input.id,
      email: input.email,
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
  }
}

export const createAuthService = ({
  repository,
  sessionTtlMs = defaultSessionTtlMs,
}: CreateAuthServiceOptions): AuthService => ({
  createUser: async ({ email, password, now = new Date() }) => {
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await hashServicePassword(password);

    return await repository.createAccount({
      id: createId("acct"),
      email: normalizedEmail,
      passwordHash,
      now,
    });
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
});

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

const createId = (prefix: "acct" | "sess"): string =>
  `${prefix}_${randomBytes(idBytes).toString("base64url")}`;
