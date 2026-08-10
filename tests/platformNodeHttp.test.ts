import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { createServer as createHttpsServer, request as httpsRequest, type Server as HttpsServer } from "node:https";
import { afterEach, describe, expect, it } from "vitest";
import type { PlatformHttpHandler, PlatformHttpRequest } from "../src/platform/platformHttp.js";
import {
  clearMockdSessionCookie,
  createPlatformNodeHttpAdapter,
  mockdSessionCookie,
} from "../src/platform/platformNodeHttp.js";

let server: HttpServer | HttpsServer | undefined;
type TestAdapterOptions = NonNullable<Parameters<typeof createPlatformNodeHttpAdapter>[1]>;

const testHttpsKey = `
-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgjfVDyg78ElgSRTkU
VZcqJ6TPYr2v3enO8jWlx7FoH3uhRANCAAQby1M3iNMViQi6L90EnKFHx5qR7jBy
xJUneqLE5aOPxHeQNPcfbC8iDjie2htkhIoOwFOutF2Xab+kksTLteV4
-----END PRIVATE KEY-----
`.trim();

const testHttpsCertificate = `
-----BEGIN CERTIFICATE-----
MIIBfDCCASOgAwIBAgIUFjJffVxdBBndT5HYXbc//YGpVZkwCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJMTI3LjAuMC4xMB4XDTI2MDgxMDE5MjcyOFoXDTI2MDgxMTE5
MjcyOFowFDESMBAGA1UEAwwJMTI3LjAuMC4xMFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEG8tTN4jTFYkIui/dBJyhR8eake4wcsSVJ3qixOWjj8R3kDT3H2wvIg44
ntobZISKDsBTrrRdl2m/pJLEy7XleKNTMFEwHQYDVR0OBBYEFCr8cmFHj7Seisrb
qi6rCQXBcm0nMB8GA1UdIwQYMBaAFCr8cmFHj7Seisrbqi6rCQXBcm0nMA8GA1Ud
EwEB/wQFMAMBAf8wCgYIKoZIzj0EAwIDRwAwRAIgWTkWy6SKzE80xEVlSrNEuBqL
MDZEcK8q1/DNsc/LA9ICIFdwo2yBcmvXOR+horr2dxgmR+b6W4juUzWxMHhvWRdv
-----END CERTIFICATE-----
`.trim();

const listen = async (
  handle: PlatformHttpHandler,
  options: TestAdapterOptions = {},
): Promise<string> => {
  server = createHttpServer(createPlatformNodeHttpAdapter(handle, options));

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

const listenHttps = async (
  handle: PlatformHttpHandler,
  options: TestAdapterOptions = {},
): Promise<string> => {
  server = createHttpsServer(
    { key: testHttpsKey, cert: testHttpsCertificate },
    createPlatformNodeHttpAdapter(handle, options),
  );

  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected TCP test server address.");
  }

  return `https://127.0.0.1:${address.port}`;
};

const jsonFetch = async (
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; contentType: string | null; setCookie: string | null; body: unknown }> => {
  const response = await fetch(`${baseUrl}${path}`, init);

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    setCookie: response.headers.get("set-cookie"),
    body: await response.json(),
  };
};

const httpsJsonFetch = async (
  baseUrl: string,
  path: string,
): Promise<{ status: number; body: unknown }> =>
  await new Promise((resolve, reject) => {
    const request = httpsRequest(
      `${baseUrl}${path}`,
      { rejectUnauthorized: false },
      response => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: response.statusCode ?? 0,
            body: JSON.parse(bodyText) as unknown,
          });
        });
      },
    );
    request.once("error", reject);
    request.end();
  });

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
      setCookie: null,
      body: {
        method: "POST",
        path: "/accounts?source=test",
        body: { email: "cam@example.com", password: "secure password" },
      },
    });
    expect(seenRequests).toHaveLength(1);
  });

  it("serializes text event stream responses without JSON wrapping", async () => {
    const baseUrl = await listen(async () => ({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
      body: "id: room_1:2\nevent: room.started\ndata: {\"revision\":2}\n\n",
    }));

    const response = await fetch(`${baseUrl}/live-rooms/room_1/event-stream?afterRevision=1`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await response.text()).toBe("id: room_1:2\nevent: room.started\ndata: {\"revision\":2}\n\n");
  });

  it("serves the configured platform shell without calling the JSON handler", async () => {
    let callCount = 0;
    const baseUrl = await listen(async () => {
      callCount += 1;

      return { status: 404, body: { error: { code: "nope", message: "Nope." } } };
    }, { appHtml: "<!doctype html><title>Mockd app</title>" });

    const response = await fetch(`${baseUrl}/login`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe("<!doctype html><title>Mockd app</title>");
    expect(callCount).toBe(0);
  });

  it("adds minimal security headers to JSON and HTML responses", async () => {
    const baseUrl = await listen(async () => ({ status: 200, body: { ok: true } }), {
      appHtml: "<!doctype html><title>Mockd app</title>",
    });

    const jsonResponse = await fetch(`${baseUrl}/api/status`);
    const htmlResponse = await fetch(`${baseUrl}/login`);

    for (const response of [jsonResponse, htmlResponse]) {
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
  });

  it("marks platform requests as secure for directly HTTPS traffic", async () => {
    const seenRequests: PlatformHttpRequest[] = [];
    const baseUrl = await listenHttps(async request => {
      seenRequests.push(request);

      return { status: 200, body: { ok: true } };
    });

    await httpsJsonFetch(baseUrl, "/session");

    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0]?.isSecure).toBe(true);
  });

  it("serves auth shell and draft workspace HTML from their browser routes", async () => {
    let callCount = 0;
    const authShellHtml = "<!doctype html><main id=\"auth-panel\"></main>";
    const draftRoomHtml = "<!doctype html><main id=\"draft-room-view\"></main>";
    const baseUrl = await listen(async () => {
      callCount += 1;

      return { status: 404, body: { error: { code: "nope", message: "Nope." } } };
    }, { appHtml: authShellHtml, draftRoomHtml });

    for (const path of ["/login", "/signup", "/setup"]) {
      const response = await fetch(`${baseUrl}${path}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await response.text()).toBe(authShellHtml);
    }

    for (const path of ["/draft-room", "/mock-results", "/my-expert", "/player-news"]) {
      const response = await fetch(`${baseUrl}${path}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await response.text()).toBe(draftRoomHtml);
    }

    expect(callCount).toBe(0);
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
      setCookie: null,
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
    }, { maxBodyBytes: 10 });

    const response = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "cam@example.com" }),
    });

    expect(callCount).toBe(0);
    expect(response).toEqual({
      status: 413,
      contentType: "application/json; charset=utf-8",
      setCookie: null,
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

  it("serializes platform response headers", async () => {
    const baseUrl = await listen(async () => ({
      status: 200,
      headers: {
        "Set-Cookie": mockdSessionCookie("browser-session-token", { maxAgeSeconds: 60 }),
      },
      body: { ok: true },
    }));

    const response = await jsonFetch(baseUrl, "/sessions", { method: "POST" });

    expect(response).toEqual({
      status: 200,
      contentType: "application/json; charset=utf-8",
      setCookie: "mockd_session=browser-session-token; Path=/; Max-Age=60; HttpOnly; SameSite=Lax",
      body: { ok: true },
    });
  });
});
