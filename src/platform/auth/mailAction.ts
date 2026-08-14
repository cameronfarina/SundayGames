import { sameOriginAuthenticationReturnPath } from "../authenticationReturnPath.js";
import type { AuthMailSender } from "./mailContracts.js";
import { createAuthToken, createId, hashAuthToken } from "./primitives.js";
import type { AuthRepository } from "./repositoryContracts.js";
import type { AccountRecord, AuthTokenPurpose } from "./records.js";

export interface SendAuthActionInput {
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

export const sendAuthAction = async (input: SendAuthActionInput): Promise<void> => {
  if (input.mailSender === undefined || input.publicBaseUrl === undefined) {
    throw new Error("Auth mail delivery and public base URL must be configured.");
  }
  const rawToken = createAuthToken();
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
