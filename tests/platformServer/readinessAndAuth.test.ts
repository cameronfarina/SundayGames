import { CapturingAuthMailSender, expect, it, jsonFetch, now } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("reports dependency readiness through the real HTTP server", async () => {
    let ready = false;
    const { platformServer, baseUrl } = await createListeningServer({
      readinessProbe: async () => ready,
    });

    await expect(jsonFetch(baseUrl, "/healthz")).resolves.toMatchObject({
      status: 200,
      body: { status: "ok" },
    });
    await expect(jsonFetch(baseUrl, "/readyz")).resolves.toMatchObject({
      status: 503,
      body: { status: "unavailable" },
    });

    ready = true;
    await expect(jsonFetch(baseUrl, "/readyz")).resolves.toMatchObject({
      status: 200,
      body: { status: "ok" },
    });
  });

  it("creates accounts and logs in through the real HTTP server", async () => {
    const { baseUrl } = await createListeningServer();

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "  Owner11@Example.com ",
        password: "secure password1!",
      }),
    });

    expect(created).toMatchObject({
      status: 201,
      contentType: "application/json; charset=utf-8",
      body: {
        account: {
          id: expect.stringMatching(/^acct_/),
          email: "owner11@example.com",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      },
    });

    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password1!",
      }),
    });

    expect(login).toMatchObject({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: {
        account: {
          id: expect.stringMatching(/^acct_/),
          email: "owner11@example.com",
        },
        session: {
          id: expect.stringMatching(/^sess_/),
          accountId: expect.any(String),
          createdAt: now.toISOString(),
        },
      },
    });
    expect(login.setCookie).toContain("mockd_session=");
    expect(login.body).not.toHaveProperty("sessionToken");
    expect(JSON.stringify(login.body)).not.toContain("tokenHash");
  });

  it("verifies and recovers a production-style account through the real HTTP server", async () => {
    const authMailSender = new CapturingAuthMailSender();
    const { baseUrl } = await createListeningServer({
      emailVerificationRequired: true,
      authMailSender,
      publicBaseUrl: "https://mockd.example.com",
    });

    const signup = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" }),
    });
    expect(signup).toMatchObject({ status: 202, body: { accepted: true } });
    const verificationMessage = authMailSender.messages[0];
    const verificationToken = new URL(
      verificationMessage?.actionUrl ?? "https://invalid.local",
    ).searchParams.get("token") ?? "";

    await expect(jsonFetch(baseUrl, "/email-verifications/consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: verificationToken,
        newPassword: "mailbox proven password1!",
        newPasswordConfirmation: "mailbox proven password1!",
      }),
    })).resolves.toMatchObject({ status: 200, body: { verified: true } });
    await expect(jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", password: "mailbox proven password1!" }),
    })).resolves.toMatchObject({ status: 200 });

    await jsonFetch(baseUrl, "/password-resets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" }),
    });
    const resetMessage = authMailSender.messages[1];
    const resetToken = new URL(resetMessage?.actionUrl ?? "https://invalid.local").searchParams.get("token") ?? "";
    await expect(jsonFetch(baseUrl, "/password-resets/consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: resetToken,
        newPassword: "replacement password1!",
        newPasswordConfirmation: "replacement password1!",
      }),
    })).resolves.toMatchObject({ status: 200, body: { reset: true } });
  });
});
