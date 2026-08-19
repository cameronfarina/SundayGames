import {
  CapturingAuthMailSender,
  CapturingSignupNotifier,
  InMemoryPlatformStore,
  createPlatformApp,
  createPlatformHttpHandler,
  describe,
  expect,
  it,
  mockRunner,
  now,
} from "../support/index.js";

describe("platform HTTP contract", () => {
it("notifies the site owner once a production signup verifies its email", async () => {
    const mailSender = new CapturingAuthMailSender();
    const signupNotifier = new CapturingSignupNotifier();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: mockRunner,
      authEmail: {
        verificationRequired: true,
        mailSender,
        publicBaseUrl: "https://mockd.example.com",
        signupNotifier,
      },
    });
    const handle = createPlatformHttpHandler(app, { emailVerificationRequired: true });

    await handle({
      method: "POST",
      path: "/accounts",
      now,
      body: { email: "owner@example.com" },
    });
    expect(signupNotifier.notifications).toHaveLength(0);

    const verificationMessage = mailSender.messages[0];
    if (verificationMessage === undefined) throw new Error("Expected a verification email.");
    const verificationToken = new URL(verificationMessage.actionUrl).searchParams.get("token");
    if (verificationToken === null) throw new Error("Expected a verification token.");
    await handle({
      method: "POST",
      path: "/email-verifications/consume",
      now: new Date(now.getTime() + 1_000),
      body: {
        token: verificationToken,
        newPassword: "mailbox proven password",
        newPasswordConfirmation: "mailbox proven password",
      },
    });

    expect(signupNotifier.notifications).toEqual([
      { email: "owner@example.com", signedUpAt: new Date(now.getTime() + 1_000) },
    ]);
  });

it("notifies the site owner immediately for local auto-verified signup", async () => {
    const signupNotifier = new CapturingSignupNotifier();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: mockRunner,
      authEmail: { verificationRequired: false, signupNotifier },
    });
    const handle = createPlatformHttpHandler(app);

    await handle({
      method: "POST",
      path: "/accounts",
      now,
      body: { email: "local@example.com", password: "a valid local password" },
    });

    expect(signupNotifier.notifications).toEqual([{ email: "local@example.com", signedUpAt: now }]);
  });

it("never blocks signup when the notifier fails", async () => {
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: mockRunner,
      authEmail: {
        verificationRequired: false,
        signupNotifier: { notify: () => Promise.reject(new Error("resend is down")) },
      },
    });
    const handle = createPlatformHttpHandler(app);

    await expect(handle({
      method: "POST",
      path: "/accounts",
      now,
      body: { email: "resilient@example.com", password: "a valid local password" },
    })).resolves.toMatchObject({ status: 201 });
  });
});
