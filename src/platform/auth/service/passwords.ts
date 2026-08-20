import { AuthError } from "../errors.js";
import {
  hashSessionToken,
  normalizeEmail,
  validateCurrentPassword,
  validatePassword,
  verifyServicePassword,
} from "../primitives.js";
import type { PasswordReplacementResult } from "../records.js";
import type { AuthenticatedSession, ChangePasswordInput, ResetPasswordInput } from "../serviceContracts.js";
import type { AuthServiceContext } from "./context.js";

const findAuthenticatedSession = async (
  context: AuthServiceContext,
  sessionToken: string,
  now: Date,
): Promise<AuthenticatedSession | null> => {
  const session = await context.repository.findSessionByTokenHash(hashSessionToken(sessionToken));
  if (session === null || session.revokedAt !== undefined || session.expiresAt <= now) return null;
  const account = await context.repository.findAccountById(session.accountId);
  return account === null ? null : { account, session };
};

export const changePassword = async (
  context: AuthServiceContext,
  input: ChangePasswordInput,
): Promise<PasswordReplacementResult> => {
  const now = input.now ?? new Date();
  const authenticated = await findAuthenticatedSession(context, input.sessionToken, now);
  if (authenticated === null) {
    throw new AuthError("auth_required", "Sign in before changing your password.");
  }
  const credential = await context.repository.findAccountCredentialByEmail(authenticated.account.email);
  if (credential === null) {
    throw new AuthError("auth_required", "Sign in before changing your password.");
  }
  validateCurrentPassword(input.currentPassword);
  if (!(await verifyServicePassword(input.currentPassword, credential.passwordHash))) {
    throw new AuthError("invalid_current_password", "Current password is incorrect.");
  }
  if (input.newPassword !== input.newPasswordConfirmation) {
    throw new AuthError("password_confirmation_mismatch", "New passwords do not match.");
  }
  validatePassword(input.newPassword);
  if (await verifyServicePassword(input.newPassword, credential.passwordHash)) {
    throw new AuthError("password_unchanged", "Choose a password you have not already used.");
  }

  const passwordHash = await context.passwordHasher(input.newPassword);
  const result = await context.repository.replacePasswordAndRevokeSessions({
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
};

export const resetPassword = async (
  context: AuthServiceContext,
  input: ResetPasswordInput,
): Promise<PasswordReplacementResult | null> => {
  const now = input.now ?? new Date();
  validatePassword(input.newPassword);
  const normalizedEmail = normalizeEmail(input.email);
  const credential = await context.repository.findAccountCredentialByEmail(normalizedEmail);
  if (credential === null) return null;
  const passwordHash = await context.passwordHasher(input.newPassword);
  return await context.repository.replacePasswordAndRevokeSessions({
    accountId: credential.account.id,
    passwordHash,
    now,
  });
};
