import {
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  verifyPassword,
  type AccountRecord,
  type SessionRecord,
} from "../auth.js";
import { localDemoPassword } from "../localDemoFixtures.js";
import type { LocalE2eSeedPlatformApp, SeedLocalE2eAccount } from "./contracts.js";
import { seedSessionExpiresAt, type SeedAccountFixture } from "./fixtures.js";

const ensureSeedAccount = async (
  app: LocalE2eSeedPlatformApp,
  fixture: SeedAccountFixture,
  now: Date,
): Promise<AccountRecord> => {
  const email = normalizeEmail(fixture.email);
  const existing = await app.authRepository.findAccountCredentialByEmail(email);
  if (existing !== null) {
    if (!verifyPassword(localDemoPassword, existing.passwordHash)) {
      throw new Error(`Existing account ${email} does not match the local E2E seed password.`);
    }
    return existing.account;
  }
  return await app.authRepository.createAccount({
    id: fixture.id,
    email,
    passwordHash: hashPassword(localDemoPassword),
    now,
  });
};

const ensureSeedSession = async (
  app: LocalE2eSeedPlatformApp,
  account: AccountRecord,
  fixture: SeedAccountFixture,
  now: Date,
): Promise<SessionRecord> => {
  const tokenHash = hashSessionToken(fixture.sessionToken);
  const existing = await app.authRepository.findSessionById(fixture.sessionId);
  if (existing !== null) {
    if (existing.accountId !== account.id || existing.tokenHash !== tokenHash) {
      throw new Error(`Existing session ${fixture.sessionId} does not match the local E2E seed account.`);
    }
    if (existing.revokedAt === undefined && existing.expiresAt > now) return existing;
    throw new Error(`Existing session ${fixture.sessionId} is expired or revoked.`);
  }
  return await app.authRepository.createSession({
    id: fixture.sessionId,
    accountId: account.id,
    tokenHash,
    createdAt: now,
    expiresAt: seedSessionExpiresAt,
  });
};

export const seedAccount = async (
  app: LocalE2eSeedPlatformApp,
  fixture: SeedAccountFixture,
  now: Date,
): Promise<SeedLocalE2eAccount> => {
  const account = await ensureSeedAccount(app, fixture, now);
  await ensureSeedSession(app, account, fixture, now);
  return {
    accountId: account.id,
    email: account.email,
    password: localDemoPassword,
    sessionToken: fixture.sessionToken,
  };
};
