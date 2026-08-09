import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import type { PlatformHttpHandler, PlatformHttpRequest } from "../src/platform/platformHttp.js";
import {
  clearMockdSessionCookie,
  createPlatformNodeHttpAdapter,
  mockdSessionCookie,
} from "../src/platform/platformNodeHttp.js";

let server: Server | undefined;

const listen = async (handle: PlatformHttpHandler, maxBodyBytes?: number): Promise<string> => {
  server = createServer(createPlatformNodeHttpAdapter(handle, { maxBodyBytes }));

  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected TCP test server address.");
  }

  return `http://127.0.0.1:${address.port}`;
};

const jsonFetch = async (
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; contentType: string | null; body: unknown }> => {
  const response = await fetch(`${baseUrl}${path}`, init);

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.json(),
  };
};

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    if (server === undefined) {
      resolve();
      return;
    }

    server.close(error => {
      server = undefined;
      if (error === undefined) resolve();
      else reject(error);
    });
  });
});

describe("platform Node HTTP adapter", () => {
  it("parses JSON request bodies and serializes platform JSON responses", async () => {
    const seenRequests: PlatformHttpRequest[] = [];
    const baseUrl = await listen(async request => {
      seenRequests.push(request);

      return {
        status: 201,
        body: {
          method: request.method,
          path: request.path,
          body: request.body,
        },
      };
    });

    const response = await jsonFetch(baseUrl, "/accounts?source=test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "cam@example.com", password: "secure password" }),
    });

    expect(response).toEqual({
      status: 201,
      contentType: "application/json; charset=utf-8",
      body: {
        method: "POST",
        path: "/accounts?source=test",
        body: { email: "cam@example.com", password: "secure password" },
      },
    });
    expect(seenRequests).toHaveLength(1);
  });

  it("extracts session tokens from bearer, x-session-token, and mockd_session cookies only", async () => {
    const seenTokens: (string | undefined)[] = [];
    const seenAuthorizationHeaders: (string | undefined)[] = [];
    const seenSessionHeaders: (string | undefined)[] = [];
    const seenXSessionHeaders: (string | undefined)[] = [];
    const seenLegacySessionHeaders: (string | undefined)[] = [];
    const baseUrl = await listen(async request => {
      seenTokens.push(request.sessionToken);
      seenAuthorizationHeaders.push(request.headers?.authorization);
      seenSessionHeaders.push(request.headers?.cookie);
      seenXSessionHeaders.push(request.headers?.["x-session-token"]);
      seenLegacySessionHeaders.push(request.headers?.["session-token"]);

      return {
        status: request.sessionToken === undefined ? 401 : 200,
        body: { sessionToken: request.sessionToken ?? null },
      };
    });

    await jsonFetch(baseUrl, "/from-bearer", {
      headers: { authorization: "Bearer bearer-token" },
    });
    await jsonFetch(baseUrl, "/from-header", {
      headers: { "x-session-token": "header-token" },
    });
    await jsonFetch(baseUrl, "/from-cookie", {
      headers: { cookie: "theme=dark; mockd_session=cookie-token; other=value" },
    });
    await jsonFetch(baseUrl, "/ignored?sessionToken=query-token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "session-token": "legacy-header-token",
      },
      body: JSON.stringify({ sessionToken: "body-token" }),
    });

    expect(seenTokens).toEqual([
      "bearer-token",
      "header-token",
      "cookie-token",
      undefined,
    ]);
    expect(seenAuthorizationHeaders).toEqual([undefined, undefined, undefined, undefined]);
    expect(seenSessionHeaders).toEqual([undefined, undefined, undefined, undefined]);
    expect(seenXSessionHeaders).toEqual([undefined, undefined, undefined, undefined]);
    expect(seenLegacySessionHeaders).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("returns stable malformed JSON responses before calling the platform handler", async () => {
    let callCount = 0;
    const baseUrl = await listen(async () => {
      callCount += 1;

      return { status: 200, body: { ok: true } };
    });

    const response = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{\"email\":",
    });

    expect(callCount).toBe(0);
    expect(response).toEqual({
      status: 400,
      contentType: "application/json; charset=utf-8",
      body: {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
        },
      },
    });
  });

  it("returns stable large body responses before calling the platform handler", async () => {
    let callCount = 0;
    const baseUrl = await listen(async () => {
      callCount += 1;

      return { status: 200, body: { ok: true } };
    }, 10);

    const response = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "cam@example.com" }),
    });

    expect(callCount).toBe(0);
    expect(response).toEqual({
      status: 413,
      contentType: "application/json; charset=utf-8",
      body: {
        error: {
          code: "request_body_too_large",
          message: "Request body exceeds the configured size limit.",
        },
      },
    });
  });

  it("builds login and logout Set-Cookie values without tokenHash material", () => {
    const accidentalCookieOptions = { secure: true, tokenHash: "sha256-token-hash" };

    expect(mockdSessionCookie("session-token", { secure: true, maxAgeSeconds: 3_600 })).toBe(
      "mockd_session=session-token; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax",
    );
    expect(clearMockdSessionCookie({ secure: true })).toBe(
      "mockd_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax",
    );
    expect(mockdSessionCookie("session-token", accidentalCookieOptions)).not.toContain(
      "sha256-token-hash",
    );
  });
});
