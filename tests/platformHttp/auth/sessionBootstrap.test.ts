import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectAccount, expectBodyRecord, it, mockRunner, now, sessionTokenFrom } from "../support/index.js";

describe("platform HTTP contract", () => {
it("bootstraps and clears the current browser session", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const owner11 = await createLoggedInAccount(handle, "owner11@example.com");

    const current = await handle({
      method: "GET",
      path: "/session",
      sessionToken: owner11.sessionToken,
      now,
    });
    const loggedOut = await handle({
      method: "DELETE",
      path: "/session",
      sessionToken: owner11.sessionToken,
      headers: { host: "mockd.example.com" },
      now: new Date(now.getTime() + 1_000),
    });
    const afterLogout = await handle({
      method: "GET",
      path: "/session",
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 2_000),
    });

    expect(current).toMatchObject({
      status: 200,
      body: {
        account: {
          id: owner11.account.id,
          email: "owner11@example.com",
        },
      },
    });
    expect(loggedOut).toEqual({
      status: 200,
      headers: {
        "Set-Cookie": "mockd_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax",
      },
      body: { ok: true },
    });
    expect(afterLogout).toEqual({
      status: 401,
      body: {
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      },
    });
  });

it("does not authenticate protected routes with session tokens in query strings or bodies", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const owner11 = await createLoggedInAccount(handle, "owner11@example.com");

    const queryTokenResponse = await handle({
      method: "GET",
      path: `/seasons/missing-season?sessionToken=${encodeURIComponent(owner11.sessionToken)}`,
    });
    const bodyTokenResponse = await handle({
      method: "GET",
      path: "/seasons/missing-season",
      body: {
        sessionToken: owner11.sessionToken,
      },
    });

    expect(queryTokenResponse).toEqual({
      status: 401,
      body: {
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      },
    });
    expect(bodyTokenResponse).toEqual(queryTokenResponse);
  });

it("uses trusted request time instead of client-provided body or query time for auth", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    const created = await handle({
      method: "POST",
      path: "/accounts",
      now,
      body: {
        email: "owner11@example.com",
        password: "secure password1!",
        now: new Date("2099-01-01T00:00:00.000Z"),
      },
    });
    const login = await handle({
      method: "POST",
      path: "/sessions",
      now,
      body: {
        email: "owner11@example.com",
        password: "secure password1!",
        now: new Date("2099-01-01T00:00:00.000Z"),
      },
    });
    const account = expectAccount(expectBodyRecord(created.body).account);
    const sessionToken = sessionTokenFrom(login);
    const afterDefaultSessionExpiry = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);

    expect(account.createdAt).toEqual(now);

    const protectedResponse = await handle({
      method: "GET",
      path: `/seasons/missing-season?now=${encodeURIComponent(now.toISOString())}`,
      sessionToken,
      now: afterDefaultSessionExpiry,
      body: {
        now,
      },
    });

    expect(protectedResponse).toEqual({
      status: 401,
      body: {
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      },
    });
  });
});
