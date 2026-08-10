import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type AuthErrorCode = "duplicate_email" | "invalid_email" | "invalid_password";
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

export interface AuthRepository {
  createAccount(input: CreateAccountRecordInput): MaybePromise<AccountRecord>;
  findAccountCredentialByEmail(normalizedEmail: string): MaybePromise<AccountCredentialRecord | null>;
  findAccountById(accountId: string): MaybePromise<AccountRecord | null>;
  createSession(input: CreateSessionRecordInput): MaybePromise<SessionRecord>;
  findSessionByTokenHash(tokenHash: string): MaybePromise<SessionRecord | null>;
  findSessionById(sessionId: string): MaybePromise<SessionRecord | null>;
  revokeSession(sessionId: string, revokedAt: Date): MaybePromise<SessionRecord | null>;
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

export interface AuthService {
  createUser(input: CreateUserInput): Promise<AccountRecord>;
  login(input: LoginInput): Promise<LoginResult | null>;
  lookupSession(sessionToken: string, now?: Date): Promise<AuthenticatedSession | null>;
  logout(sessionToken: string, now?: Date): Promise<boolean>;
  revokeSession(sessionId: string, now?: Date): Promise<boolean>;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const defaultSessionTtlMs = 1000 * 60 * 60 * 24 * 30;
const passwordSaltBytes = 16;
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
  if (password.length === 0) {
    throw new AuthError("invalid_password", "Password cannot be empty.");
  }

  const salt = randomBytes(passwordSaltBytes).toString("base64url");
  const derivedKey = derivePasswordKey(password, salt);

  return [
    "scrypt",
    String(scryptCost),
    String(scryptBlockSize),
    String(scryptParallelization),
    salt,
    derivedKey,
  ].join("$");
};

export const verifyPassword = (password: string, storedPasswordHash: string): boolean => {
  const parsedHash = parsePasswordHash(storedPasswordHash);

  if (parsedHash === null) {
    return false;
  }

  const derivedKey = derivePasswordKey(password, parsedHash.salt);
  const storedKey = Buffer.from(parsedHash.derivedKey, "base64url");
  const candidateKey = Buffer.from(derivedKey, "base64url");

  return storedKey.length === candidateKey.length && timingSafeEqual(storedKey, candidateKey);
};

export const createSessionToken = (): string => randomBytes(sessionTokenBytes).toString("base64url");

export const hashSessionToken = (sessionToken: string): string =>
  createHash("sha256").update(sessionToken).digest("base64url");

export class InMemoryAuthRepository implements AuthRepository {
  readonly #accountsById = new Map<string, AccountCredentialRecord>();
  readonly #accountIdsByEmail = new Map<string, string>();
  readonly #sessionsById = new Map<string, SessionRecord>();
  readonly #sessionIdsByTokenHash = new Map<string, string>();

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

    return session;
  }

  findSessionByTokenHash(tokenHash: string): SessionRecord | null {
    const sessionId = this.#sessionIdsByTokenHash.get(tokenHash);

    if (sessionId === undefined) {
      return null;
    }

    return this.#sessionsById.get(sessionId) ?? null;
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
  }
}

export const createAuthService = ({
  repository,
  sessionTtlMs = defaultSessionTtlMs,
}: CreateAuthServiceOptions): AuthService => ({
  createUser: async ({ email, password, now = new Date() }) => {
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = hashPassword(password);

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

    if (credential === null || !verifyPassword(password, credential.passwordHash)) {
      return null;
    }

    const sessionToken = createSessionToken();
    const expiresAt = new Date(now.getTime() + (loginSessionTtlMs ?? sessionTtlMs));
    const session = await repository.createSession({
      id: createId("sess"),
      accountId: credential.account.id,
      tokenHash: hashSessionToken(sessionToken),
      createdAt: now,
      expiresAt,
    });

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
});

const derivePasswordKey = (password: string, salt: string): string =>
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
