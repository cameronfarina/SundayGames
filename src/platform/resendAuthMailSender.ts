import type { AuthMailSender } from "./auth.js";

export interface CreateResendAuthMailSenderOptions {
  apiKey: string;
  from: string;
  fetcher?: typeof fetch | undefined;
}

const resendEmailsUrl = "https://api.resend.com/emails";

export const createResendAuthMailSender = ({
  apiKey,
  from,
  fetcher = fetch,
}: CreateResendAuthMailSenderOptions): AuthMailSender => ({
  send: async message => {
    const response = await fetcher(resendEmailsUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Auth email delivery failed with status ${response.status}.`);
    }
  },
});
