import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, now, sessionTokenFrom } from "../support/index.js";

describe("platform HTTP contract", () => {
it("changes a signed-in password, clears the cookie, and requires every device to sign in again", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const firstLogin = await createLoggedInAccount(handle, "password-http@example.com");
    const secondLogin = await handle({
      method: "POST",
      path: "/sessions",
      body: { email: firstLogin.account.email, password: "secure password1!" },
    });
    const secondToken = sessionTokenFrom(secondLogin);

    await expect(handle({
      method: "PUT",
      path: "/session/password",
      sessionToken: "",
      body: {
        currentPassword: "secure password1!",
        newPassword: "replacement secure password1!",
        newPasswordConfirmation: "replacement secure password1!",
      },
    })).resolves.toMatchObject({
      status: 401,
      body: { error: { code: "auth_required" } },
    });
    await expect(handle({
      method: "PUT",
      path: "/session/password",
      sessionToken: firstLogin.sessionToken,
      body: {
        currentPassword: "wrong current password",
        newPassword: "replacement secure password1!",
        newPasswordConfirmation: "replacement secure password1!",
      },
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "invalid_current_password" } },
    });

    const response = await handle({
      method: "PUT",
      path: "/session/password",
      sessionToken: firstLogin.sessionToken,
      now: new Date(now.getTime() + 2),
      body: {
        currentPassword: "secure password1!",
        newPassword: "replacement secure password1!",
        newPasswordConfirmation: "replacement secure password1!",
      },
    });
    expect(response).toMatchObject({
      status: 200,
      body: { ok: true },
      headers: { "Set-Cookie": expect.stringContaining("Max-Age=0") },
    });
    await expect(handle({ method: "GET", path: "/session", sessionToken: firstLogin.sessionToken }))
      .resolves.toMatchObject({ status: 401 });
    await expect(handle({ method: "GET", path: "/session", sessionToken: secondToken }))
      .resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      body: { email: firstLogin.account.email, password: "secure password1!" },
    })).resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      body: { email: firstLogin.account.email, password: "replacement secure password1!" },
    })).resolves.toMatchObject({ status: 200 });
  });
});
