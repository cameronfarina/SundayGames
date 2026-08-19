import type { SignupNotifier } from "./auth/signupNotifierContracts.js";

export interface CreateResendSignupNotifierOptions {
  apiKey: string;
  from: string;
  to: string;
  fetcher?: typeof fetch | undefined;
}

const resendEmailsUrl = "https://api.resend.com/emails";

export const createResendSignupNotifier = ({
  apiKey,
  from,
  to,
  fetcher = fetch,
}: CreateResendSignupNotifierOptions): SignupNotifier => ({
  notify: async notification => {
    const response = await fetcher(resendEmailsUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "New Sunday Games signup",
        text: `${notification.email} signed up at ${notification.signedUpAt.toISOString()}.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Signup notification delivery failed with status ${response.status}.`);
    }
  },
});
