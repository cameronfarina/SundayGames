import { AuthError } from "../errors.js";
import { sendAuthAction } from "../mailAction.js";
import { createId, createPendingPasswordHash, normalizeEmail, validatePassword } from "../primitives.js";
import type { AccountRecord } from "../records.js";
import type { CreateUserInput } from "../serviceContracts.js";
import type { AuthServiceContext } from "./context.js";
import { notifySignup } from "./signupNotification.js";

export const createUser = async (
  context: AuthServiceContext,
  input: CreateUserInput,
): Promise<AccountRecord> => {
  const now = input.now ?? new Date();
  const normalizedEmail = normalizeEmail(input.email);
  if (!context.emailVerificationRequired) {
    if (input.password === undefined) {
      throw new AuthError("invalid_password", "Password is required.");
    }
    validatePassword(input.password);
    const passwordHash = await context.passwordHasher(input.password);
    const account = await context.repository.createAccount({
      id: createId("acct"),
      email: normalizedEmail,
      passwordHash,
      emailVerifiedAt: now,
      now,
    });
    await notifySignup(context, account, now);
    return account;
  }

  const passwordHash = await createPendingPasswordHash(context.passwordHasher);
  const registration = await context.repository.createOrReplacePendingAccount({
    id: createId("acct"),
    email: normalizedEmail,
    passwordHash,
    now,
  });
  if (registration.status !== "verified") {
    await sendAuthAction({
      repository: context.repository,
      mailSender: context.mailSender,
      publicBaseUrl: context.publicBaseUrl,
      account: registration.account,
      purpose: "email_verification",
      returnTo: input.verificationReturnTo,
      now,
      ttlMs: context.verificationTokenTtlMs,
      expectedCredentialVersion: registration.credentialVersion,
    });
  }
  return registration.account;
};
