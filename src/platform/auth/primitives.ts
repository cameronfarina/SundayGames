import { createHash, randomBytes } from "node:crypto";
import {
  consumeUnknownPasswordVerification,
  createPasswordHash,
  createPasswordHashSync,
  passwordValidationIssue,
  verifyPasswordHash,
  verifyPasswordHashSync,
} from "../passwordCrypto.js";
import { AuthError } from "./errors.js";

export const defaultSessionTtlMs = 1000 * 60 * 60 * 24 * 30;
export const defaultVerificationTokenTtlMs = 1000 * 60 * 60 * 24;
export const defaultPasswordResetTokenTtlMs = 1000 * 60 * 30;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string): string => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!emailPattern.test(normalizedEmail)) {
    throw new AuthError("invalid_email", "Enter a valid email address.");
  }
  return normalizedEmail;
};

export const validatePassword = (password: string): void => {
  const issue = passwordValidationIssue(password);
  if (issue === "too_short") {
    throw new AuthError("invalid_password", "Password must be at least 15 characters.");
  }
  if (issue === "too_long") {
    throw new AuthError("invalid_password", "Password must be no more than 1024 UTF-8 bytes.");
  }
};

export const hashPassword = (password: string): string => {
  validatePassword(password);
  return createPasswordHashSync(password);
};

export const verifyPassword = (password: string, storedPasswordHash: string): boolean =>
  verifyPasswordHashSync(password, storedPasswordHash);

export const createSessionToken = (): string => randomBytes(32).toString("base64url");

export const hashSessionToken = (sessionToken: string): string =>
  createHash("sha256").update(sessionToken).digest("base64url");

export const hashAuthToken = hashSessionToken;
export const createAuthToken = (): string => randomBytes(32).toString("base64url");

export const createId = (prefix: "acct" | "auth" | "sess"): string =>
  `${prefix}_${randomBytes(16).toString("base64url")}`;

export const hashServicePassword = async (password: string): Promise<string> => {
  validatePassword(password);
  return await createPasswordHash(password);
};

export const createPendingPasswordHash = async (
  passwordHasher: (password: string) => Promise<string>,
): Promise<string> => await passwordHasher(randomBytes(32).toString("base64url"));

export const verifyServicePassword = async (password: string, storedPasswordHash: string): Promise<boolean> =>
  await verifyPasswordHash(password, storedPasswordHash);

export const consumeUnknownPassword = async (password: string): Promise<void> => {
  await consumeUnknownPasswordVerification(password);
};
