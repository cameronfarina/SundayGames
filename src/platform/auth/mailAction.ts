import { sameOriginAuthenticationReturnPath } from "../authenticationReturnPath.js";
import type { AuthMailMessage, AuthMailSender } from "./mailContracts.js";
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

const logDeliveryFailure = (purpose: AuthTokenPurpose): void => {
  try {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "auth_email_delivery_failed",
      purpose,
    }));
  } catch {
    // Observability must never turn best-effort delivery into an unhandled rejection.
  }
};

const deliverBestEffort = (
  mailSender: AuthMailSender,
  message: AuthMailMessage,
  purpose: AuthTokenPurpose,
): void => {
  void Promise.resolve()
    .then(() => mailSender.send(message))
    .catch(() => { logDeliveryFailure(purpose); });
};

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
  deliverBestEffort(input.mailSender, {
    to: input.account.email,
    subject: verification ? "Finish your Sunday Games account" : "Reset your Sunday Games password",
    text: verification
      ? `Verify your email and choose your Sunday Games password: ${actionUrl.toString()}`
      : `Reset your Sunday Games password: ${actionUrl.toString()}`,
    actionUrl: actionUrl.toString(),
  }, input.purpose);
};
