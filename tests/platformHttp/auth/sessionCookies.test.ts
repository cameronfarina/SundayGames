import { InMemoryPlatformStore, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, now, sessionTokenFrom } from "../support/index.js";
import type { PlatformHttpRequest } from "../support/index.js";

describe("platform HTTP contract", () => {
it("marks session cookies Secure for HTTPS and forwarded HTTPS requests", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    await handle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "https@example.com",
        password: "secure password1!",
        now,
      },
    });

    const loginRequest = {
      method: "POST",
      path: "/sessions",
      isSecure: true,
      headers: { host: "localhost:3000" },
      body: {
        email: "https@example.com",
        password: "secure password1!",
        now,
      },
    } satisfies PlatformHttpRequest;
    const login = await handle(loginRequest);
    const sessionToken = sessionTokenFrom(login);

    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("Secure"));
    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("SameSite=Lax"));

    const logout = await handle({
      method: "DELETE",
      path: "/session",
      isSecure: true,
      sessionToken,
      headers: { host: "localhost:3000" },
      now: new Date(now.getTime() + 1_000),
    } satisfies PlatformHttpRequest);

    expect(logout.headers?.["Set-Cookie"]).toBe(
      "mockd_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax",
    );

    const forwardedLogin = await handle({
      method: "POST",
      path: "/sessions",
      headers: { host: "localhost:3000", "x-forwarded-proto": "https,http" },
      body: {
        email: "https@example.com",
        password: "secure password1!",
        now,
      },
    });

    expect(forwardedLogin.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("Secure"));
    expect(forwardedLogin.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("SameSite=Lax"));
  });

it("keeps loopback HTTP session cookies compatible with local development", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    await handle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "local@example.com",
        password: "secure password1!",
        now,
      },
    });

    const login = await handle({
      method: "POST",
      path: "/sessions",
      headers: { host: "127.0.0.1:3000" },
      body: {
        email: "local@example.com",
        password: "secure password1!",
        now,
      },
    });
    const sessionToken = sessionTokenFrom(login);

    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("SameSite=Lax"));
    expect(login.headers?.["Set-Cookie"]).not.toEqual(expect.stringContaining("Secure"));

    const logout = await handle({
      method: "DELETE",
      path: "/session",
      sessionToken,
      headers: { host: "127.0.0.1:3000" },
      now: new Date(now.getTime() + 1_000),
    });

    expect(logout.headers?.["Set-Cookie"]).toBe(
      "mockd_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax",
    );
  });
});
