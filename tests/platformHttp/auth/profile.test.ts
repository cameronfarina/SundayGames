import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, now } from "../support/index.js";

const handler = () => createPlatformHttpHandler(createPlatformApp({
  store: new InMemoryPlatformStore(),
  simulationRunner: mockRunner,
}));

describe("platform HTTP contract", () => {
  it("saves a display name and serves it back on the session", async () => {
    const handle = handler();
    const login = await createLoggedInAccount(handle, "profile-http@example.com");

    await expect(handle({
      method: "PUT",
      path: "/session/profile",
      sessionToken: login.sessionToken,
      now: new Date(now.getTime() + 1),
      body: { displayName: "  Cam   Farina  " },
    })).resolves.toMatchObject({
      status: 200,
      body: { account: { displayName: "Cam Farina" } },
    });

    await expect(handle({ method: "GET", path: "/session", sessionToken: login.sessionToken }))
      .resolves.toMatchObject({ status: 200, body: { account: { displayName: "Cam Farina" } } });
  });

  it("clears the display name when the field is sent empty", async () => {
    const handle = handler();
    const login = await createLoggedInAccount(handle, "profile-clear@example.com");
    await handle({
      method: "PUT",
      path: "/session/profile",
      sessionToken: login.sessionToken,
      body: { displayName: "Cam Farina" },
    });

    const cleared = await handle({
      method: "PUT",
      path: "/session/profile",
      sessionToken: login.sessionToken,
      body: { displayName: "" },
    });

    expect(cleared.status).toBe(200);
    await expect(handle({ method: "GET", path: "/session", sessionToken: login.sessionToken }))
      .resolves.toMatchObject({ status: 200, body: { account: { email: login.account.email } } });
  });

  it("keeps the session signed in, unlike a password change", async () => {
    const handle = handler();
    const login = await createLoggedInAccount(handle, "profile-session@example.com");

    const response = await handle({
      method: "PUT",
      path: "/session/profile",
      sessionToken: login.sessionToken,
      body: { displayName: "Cam Farina" },
    });

    expect(response.headers?.["Set-Cookie"]).toBeUndefined();
    await expect(handle({ method: "GET", path: "/session", sessionToken: login.sessionToken }))
      .resolves.toMatchObject({ status: 200 });
  });

  it("turns away a signed-out request", async () => {
    const handle = handler();

    await expect(handle({
      method: "PUT",
      path: "/session/profile",
      sessionToken: "",
      body: { displayName: "Cam Farina" },
    })).resolves.toMatchObject({ status: 401, body: { error: { code: "auth_required" } } });
  });

  it("turns away a name past the length limit", async () => {
    const handle = handler();
    const login = await createLoggedInAccount(handle, "profile-long@example.com");

    await expect(handle({
      method: "PUT",
      path: "/session/profile",
      sessionToken: login.sessionToken,
      body: { displayName: "c".repeat(41) },
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "invalid_display_name" } },
    });
  });

  it("allows only PUT on the profile", async () => {
    const handle = handler();
    const login = await createLoggedInAccount(handle, "profile-method@example.com");

    await expect(handle({
      method: "POST",
      path: "/session/profile",
      sessionToken: login.sessionToken,
      body: { displayName: "Cam Farina" },
    })).resolves.toMatchObject({ status: 405 });
  });
});
