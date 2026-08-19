import type { AccountRecord } from "../records.js";
import type { AuthServiceContext } from "./context.js";

/**
 * Notifies the site owner that someone signed up. Best-effort: a delivery
 * failure here must never block the account holder's own signup or login.
 */
export const notifySignup = async (
  context: AuthServiceContext,
  account: AccountRecord,
  now: Date,
): Promise<void> => {
  if (context.signupNotifier === undefined) return;
  try {
    await context.signupNotifier.notify({ email: account.email, signedUpAt: now });
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "signup_notification_failed",
      message: error instanceof Error ? error.message : String(error),
    }));
  }
};
