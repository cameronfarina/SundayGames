import { AuthError } from "../errors.js";
import { sendAuthAction } from "../mailAction.js";
import { hashAuthToken, normalizeEmail, validatePassword } from "../primitives.js";
import type { AccountRecord, PasswordReplacementResult } from "../records.js";
import type {
  AcceptedAuthRequest,
  RequestEmailVerificationInput,
  RequestPasswordResetInput,
  ResetPasswordWithTokenInput,
  VerifyEmailInput,
} from "../serviceContracts.js";
import type { AuthServiceContext } from "./context.js";

export const requestEmailVerification = async (
  context: AuthServiceContext,
  input: RequestEmailVerificationInput,
): Promise<AcceptedAuthRequest> => {
  const now = input.now ?? new Date();
  const normalizedEmail = normalizeEmail(input.email);
  const credential = await context.repository.findAccountCredentialByEmail(normalizedEmail);
  if (credential !== null && credential.account.emailVerifiedAt === undefined) {
    await sendAuthAction({
      repository: context.repository,
      mailSender: context.mailSender,
      publicBaseUrl: context.publicBaseUrl,
      account: credential.account,
      purpose: "email_verification",
      returnTo: input.verificationReturnTo,
      now,
      ttlMs: context.verificationTokenTtlMs,
    });
  }
  return { accepted: true };
};

export const verifyEmail = async (
  context: AuthServiceContext,
  input: VerifyEmailInput,
): Promise<AccountRecord> => {
  const now = input.now ?? new Date();
  if (input.newPassword !== input.newPasswordConfirmation) {
    throw new AuthError("password_confirmation_mismatch", "New passwords do not match.");
  }
  validatePassword(input.newPassword);
  const tokenHash = hashAuthToken(input.token);
  const account = await context.repository.withAuthTokenAdmission(
    { tokenHash, purpose: "email_verification", now },
    async finalizer => {
      const passwordHash = await context.passwordHasher(input.newPassword);
      return await finalizer.verifyEmailAndSetPasswordByToken({ tokenHash, passwordHash, now });
    },
  );
  if (account === null) {
    throw new AuthError("invalid_or_expired_token", "This link is invalid or has expired.");
  }
  return account;
};

export const requestPasswordReset = async (
  context: AuthServiceContext,
  input: RequestPasswordResetInput,
): Promise<AcceptedAuthRequest> => {
  const now = input.now ?? new Date();
  const normalizedEmail = normalizeEmail(input.email);
  const credential = await context.repository.findAccountCredentialByEmail(normalizedEmail);
  if (credential !== null && credential.account.emailVerifiedAt !== undefined) {
    await sendAuthAction({
      repository: context.repository,
      mailSender: context.mailSender,
      publicBaseUrl: context.publicBaseUrl,
      account: credential.account,
      purpose: "password_reset",
      now,
      ttlMs: context.passwordResetTokenTtlMs,
    });
  }
  return { accepted: true };
};

export const resetPasswordWithToken = async (
  context: AuthServiceContext,
  input: ResetPasswordWithTokenInput,
): Promise<PasswordReplacementResult> => {
  const now = input.now ?? new Date();
  if (input.newPassword !== input.newPasswordConfirmation) {
    throw new AuthError("password_confirmation_mismatch", "New passwords do not match.");
  }
  validatePassword(input.newPassword);
  const tokenHash = hashAuthToken(input.token);
  const result = await context.repository.withAuthTokenAdmission(
    { tokenHash, purpose: "password_reset", now },
    async finalizer => {
      const passwordHash = await context.passwordHasher(input.newPassword);
      return await finalizer.resetPasswordByToken({ tokenHash, passwordHash, now });
    },
  );
  if (result === null) {
    throw new AuthError("invalid_or_expired_token", "This link is invalid or has expired.");
  }
  return result;
};
