import { AuthError } from "../errors.js";
import {
  consumeUnknownPassword,
  createId,
  createSessionToken,
  hashSessionToken,
  normalizeEmail,
  validatePassword,
  verifyServicePassword,
} from "../primitives.js";
import { passwordHashNeedsRehash } from "../../passwordCrypto.js";
import type { AuthenticatedSession, LoginInput, LoginResult } from "../serviceContracts.js";
import type { AuthServiceContext } from "./context.js";

export const login = async (context: AuthServiceContext, input: LoginInput): Promise<LoginResult | null> => {
  const now = input.now ?? new Date();
  validatePassword(input.password);
  const normalizedEmail = normalizeEmail(input.email);
  let credential = await context.repository.findAccountCredentialByEmail(normalizedEmail);
  if (credential === null) {
    await consumeUnknownPassword(input.password);
    return null;
  }
  if (!(await verifyServicePassword(input.password, credential.passwordHash))) return null;
  if (credential.account.emailVerifiedAt === undefined) {
    throw new AuthError(
      "email_unverified",
      "Verify your email before signing in. We can send you a new verification link.",
    );
  }

  if (passwordHashNeedsRehash(credential.passwordHash)) {
    const passwordHash = await context.passwordHasher(input.password);
    const upgraded = await context.repository.upgradePasswordHash({
      accountId: credential.account.id,
      expectedPasswordHash: credential.passwordHash,
      passwordHash,
      now,
    });
    if (upgraded === null) {
      const refreshed = await context.repository.findAccountCredentialByEmail(normalizedEmail);
      if (refreshed === null || !(await verifyServicePassword(input.password, refreshed.passwordHash))) return null;
      credential = refreshed;
    } else {
      credential = upgraded;
    }
  }

  const sessionToken = createSessionToken();
  const expiresAt = new Date(now.getTime() + (input.sessionTtlMs ?? context.sessionTtlMs));
  const session = await context.repository.createSessionForCredential({
    id: createId("sess"),
    accountId: credential.account.id,
    expectedPasswordHash: credential.passwordHash,
    tokenHash: hashSessionToken(sessionToken),
    createdAt: now,
    expiresAt,
  });
  return session === null ? null : { account: credential.account, session, sessionToken };
};

export const lookupSession = async (
  context: AuthServiceContext,
  sessionToken: string,
  now = new Date(),
): Promise<AuthenticatedSession | null> => {
  const session = await context.repository.findSessionByTokenHash(hashSessionToken(sessionToken));
  if (session === null || session.revokedAt !== undefined || session.expiresAt <= now) return null;
  const account = await context.repository.findAccountById(session.accountId);
  return account === null ? null : { account, session };
};

export const logout = async (context: AuthServiceContext, sessionToken: string, now = new Date()): Promise<boolean> => {
  const session = await context.repository.findSessionByTokenHash(hashSessionToken(sessionToken));
  return session === null ? false : await context.repository.revokeSession(session.id, now) !== null;
};

export const revokeSession = async (
  context: AuthServiceContext,
  sessionId: string,
  now = new Date(),
): Promise<boolean> => await context.repository.revokeSession(sessionId, now) !== null;
