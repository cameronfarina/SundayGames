import type { AuthMailMessage, AuthMailSender } from "../../../src/platform/auth.js";
import {
  InMemoryPlatformStore,
  createPlatformApp,
  createPlatformHttpHandler,
  describe,
  expect,
  it,
  mockRunner,
  now,
  vi,
} from "../support/index.js";
import type {
  PlatformHttpHandler,
  PlatformHttpRequest,
  PlatformHttpResponse,
} from "../support/index.js";

interface PendingDelivery {
  promise: Promise<void>;
  started: Promise<void>;
  reject: (error: Error) => void;
}

class ControllableAuthMailSender implements AuthMailSender {
  readonly messages: AuthMailMessage[] = [];
  #nextSynchronousFailure: Error | undefined;
  #nextDelivery: {
    promise: Promise<void>;
    markStarted: () => void;
  } = { promise: Promise.resolve(), markStarted: () => undefined };

  blockNextDelivery(): PendingDelivery {
    let rejectDelivery: ((error: Error) => void) | undefined;
    let markStarted: (() => void) | undefined;
    const promise = new Promise<void>((_resolve, reject) => {
      rejectDelivery = reject;
    });
    const started = new Promise<void>(resolve => {
      markStarted = resolve;
    });
    if (rejectDelivery === undefined) throw new Error("Expected delivery rejection to initialize.");
    if (markStarted === undefined) throw new Error("Expected delivery start to initialize.");
    this.#nextDelivery = { promise, markStarted };
    return { promise, started, reject: rejectDelivery };
  }

  failNextSynchronously(error: Error): void {
    this.#nextSynchronousFailure = error;
  }

  send(message: AuthMailMessage): Promise<void> {
    this.messages.push({ ...message });
    const synchronousFailure = this.#nextSynchronousFailure;
    this.#nextSynchronousFailure = undefined;
    if (synchronousFailure !== undefined) throw synchronousFailure;
    const delivery = this.#nextDelivery;
    this.#nextDelivery = { promise: Promise.resolve(), markStarted: () => undefined };
    delivery.markStarted();
    return delivery.promise;
  }
}

interface DeliveryPrivacyCase {
  label: string;
  purpose: "email_verification" | "password_reset";
  expectedBody: object;
  prepareRequest: (
    handle: PlatformHttpHandler,
    mailSender: ControllableAuthMailSender,
  ) => Promise<PlatformHttpRequest>;
}

const latestToken = (mailSender: ControllableAuthMailSender): string => {
  const message = mailSender.messages.at(-1);
  if (message === undefined) throw new Error("Expected an authentication email.");
  const token = new URL(message.actionUrl).searchParams.get("token");
  if (token === null) throw new Error("Expected an authentication token.");
  return token;
};

const nextTurn = async (): Promise<void> => {
  await new Promise<void>(resolve => setImmediate(resolve));
};

const cases: readonly DeliveryPrivacyCase[] = [
  {
    label: "production signup",
    purpose: "email_verification",
    expectedBody: {
      accepted: true,
      message: "If this email can be registered, a verification link is on its way.",
    },
    prepareRequest: async () => ({
      method: "POST",
      path: "/accounts",
      now,
      body: { email: "signup@example.com" },
    }),
  },
  {
    label: "verification resend",
    purpose: "email_verification",
    expectedBody: {
      accepted: true,
      message: "If this email is awaiting verification, a new link is on its way.",
    },
    prepareRequest: async handle => {
      await handle({
        method: "POST",
        path: "/accounts",
        now,
        body: { email: "verification@example.com" },
      });
      return {
        method: "POST",
        path: "/email-verifications",
        now: new Date(now.getTime() + 1),
        body: { email: "verification@example.com" },
      };
    },
  },
  {
    label: "password reset",
    purpose: "password_reset",
    expectedBody: {
      accepted: true,
      message: "If an account exists for this email, a password reset link is on its way.",
    },
    prepareRequest: async (handle, mailSender) => {
      await handle({
        method: "POST",
        path: "/accounts",
        now,
        body: { email: "reset@example.com" },
      });
      await handle({
        method: "POST",
        path: "/email-verifications/consume",
        now: new Date(now.getTime() + 1),
        body: {
          token: latestToken(mailSender),
          newPassword: "mailbox proven password1!",
          newPasswordConfirmation: "mailbox proven password1!",
        },
      });
      return {
        method: "POST",
        path: "/password-resets",
        now: new Date(now.getTime() + 2),
        body: { email: "reset@example.com" },
      };
    },
  },
];

describe("generic authentication email responses", () => {
  it.each(cases)("does not expose $label delivery timing or failure", async testCase => {
    const mailSender = new ControllableAuthMailSender();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: mockRunner,
      authEmail: {
        verificationRequired: true,
        mailSender,
        publicBaseUrl: "https://mockd.example.com",
      },
    });
    const handle = createPlatformHttpHandler(app, { emailVerificationRequired: true });
    const request = await testCase.prepareRequest(handle, mailSender);
    const delivery = mailSender.blockNextDelivery();
    const loggedErrors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unhandledRejections: unknown[] = [];
    const recordUnhandledRejection = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };
    process.on("unhandledRejection", recordUnhandledRejection);

    let responseBeforeDelivery: PlatformHttpResponse | undefined;
    const responsePromise = handle(request).then(response => {
      responseBeforeDelivery = response;
      return response;
    });
    const observedResponsePromise = responsePromise.catch(() => undefined);

    try {
      await delivery.started;
      await nextTurn();
      const observedResponse = responseBeforeDelivery;
      delivery.reject(new Error(
        "owner@example.com https://mockd.example.com/reset-password?token=secret-token",
      ));
      await observedResponsePromise;
      await nextTurn();

      expect(observedResponse).toEqual({ status: 202, body: testCase.expectedBody });
      expect(unhandledRejections).toEqual([]);
      const deliveryCount = mailSender.messages.length;
      await expect(handle(request)).resolves.toEqual({ status: 202, body: testCase.expectedBody });
      expect(mailSender.messages).toHaveLength(deliveryCount + 1);

      mailSender.failNextSynchronously(new Error(
        "owner@example.com https://mockd.example.com/reset-password?token=secret-token",
      ));
      await expect(handle(request)).resolves.toEqual({ status: 202, body: testCase.expectedBody });
      await nextTurn();

      expect(loggedErrors).toHaveBeenCalledTimes(2);
      const serializedLogs = loggedErrors.mock.calls.flat().map(String);
      for (const serializedLog of serializedLogs) {
        expect(serializedLog).toMatch(new RegExp(
          `^\\{"timestamp":"[^"]+","level":"error","event":"auth_email_delivery_failed",` +
          `"purpose":"${testCase.purpose}"\\}$`,
          "u",
        ));
        expect(serializedLog).not.toContain("owner@example.com");
        expect(serializedLog).not.toContain("mockd.example.com");
        expect(serializedLog).not.toContain("secret-token");
        expect(serializedLog).not.toContain("reset-password");
      }
    } finally {
      process.off("unhandledRejection", recordUnhandledRejection);
      loggedErrors.mockRestore();
      await delivery.promise.catch(() => undefined);
    }
  });
});
