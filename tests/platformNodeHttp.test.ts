import {
  createServer as createHttpServer,
  request as httpRequest,
  type ClientRequest,
  type Server as HttpServer,
} from "node:http";
import { createServer as createHttpsServer, request as httpsRequest, type Server as HttpsServer } from "node:https";
import { afterEach, describe, expect, it } from "vitest";
import type { PlatformHttpHandler, PlatformHttpRequest } from "../src/platform/platformHttp.js";
import {
  clearMockdSessionCookie,
  createPlatformNodeHttpAdapter,
  mockdSessionCookie,
  observePlatformNodeHttpServer,
} from "../src/platform/platformNodeHttp.js";
import type { PlatformBrowserAsset } from "../src/platform/platformStaticWebAssets.js";

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

const requestBeforeSendingBody = async (
  baseUrl: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<{
  request: ClientRequest;
  response: { status: number; body: unknown };
}> => {
  let clientRequest!: ClientRequest;
  const response = new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    clientRequest = httpRequest(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-length": "1000",
        "content-type": "application/json",
        ...headers,
      },
    }, incomingResponse => {
      const chunks: Buffer[] = [];
      incomingResponse.on("data", chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      incomingResponse.on("end", () => {
        resolve({
          status: incomingResponse.statusCode ?? 0,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
        });
      });
    });
    clientRequest.once("error", reject);
    clientRequest.flushHeaders();
  });

  const guardedResponse = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      clientRequest.destroy();
      reject(new Error("Server waited for the request body."));
    }, 250);
    response.then(result => {
      clearTimeout(timeout);
      resolve(result);
    }, error => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return { request: clientRequest, response: guardedResponse };
};

const httpsJsonFetch = async (
  baseUrl: string,
  path: string,
): Promise<{
  status: number;
  strictTransportSecurity: string | string[] | undefined;
  body: unknown;
}> =>
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
            strictTransportSecurity: response.headers["strict-transport-security"],
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
  it("returns a generated request ID instead of reflecting an inbound value", async () => {
    const baseUrl = await listen(async () => ({
      status: 200,
      headers: { "X-Request-ID": "application-secret-request-id" },
      body: { ok: true },
    }));

    const response = await fetch(`${baseUrl}/healthz`, {
      headers: { "x-request-id": "caller-secret-request-id" },
    });
    const requestId = response.headers.get("x-request-id");

    expect(requestId ?? "").toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(requestId).not.toBe("caller-secret-request-id");
    expect(requestId).not.toBe("application-secret-request-id");
  });

  it("logs sanitized structured request completion records", async () => {
    const logEntries: unknown[] = [];
    server = createHttpServer(createPlatformNodeHttpAdapter(async () => ({
      status: 201,
      body: { ok: true },
    })));
    const stopObserving = observePlatformNodeHttpServer(server, {
      logger: (entry: unknown) => logEntries.push(entry),
    });
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("Expected TCP test server address.");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/accounts?invite=secret-query-token`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer secret-bearer-token",
          cookie: "mockd_session=secret-cookie-token",
          "content-type": "application/json",
          "x-mockd-provisioning-token": "secret-provisioning-token",
          "x-request-id": "secret-caller-request-id",
        },
        body: JSON.stringify({ password: "secret-body-password" }),
      },
    );
    await response.json();
    stopObserving();

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0]).toMatchObject({
      event: "http_request_completed",
      level: "info",
      method: "POST",
      requestId: response.headers.get("x-request-id"),
      route: "/accounts",
      status: 201,
    });
    expect(logEntries[0]).toEqual(expect.objectContaining({
      durationMs: expect.any(Number),
      timestamp: expect.any(String),
    }));
    expect(JSON.stringify(logEntries)).not.toMatch(
      /secret|authorization|cookie|password|provisioning|invite/i,
    );
  });

  it("logs sanitized structured errors without exception details", async () => {
    const logEntries: unknown[] = [];
    server = createHttpServer(createPlatformNodeHttpAdapter(async () => {
      throw new Error("postgres://database-user:secret-password@database.internal/mockd");
    }));
    const stopObserving = observePlatformNodeHttpServer(server, {
      logger: entry => logEntries.push(entry),
    });
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("Expected TCP test server address.");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/unknown-secret-route?token=secret-query-token`,
    );
    await response.json();
    stopObserving();

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0]).toMatchObject({
      event: "http_request_error",
      level: "error",
      method: "GET",
      requestId: response.headers.get("x-request-id"),
      route: "/<redacted>",
      status: 500,
    });
    expect(JSON.stringify(logEntries)).not.toMatch(
      /secret|password|database-user|database\.internal|postgres|stack|message/i,
    );
  });

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
    expect(seenRequests[0]?.clientAddress).toBe("127.0.0.1");
  });

  it("streams asynchronous event responses as each update becomes available", async () => {
    let releaseFinal!: () => void;
    const finalReady = new Promise<void>(resolve => {
      releaseFinal = resolve;
    });
    const baseUrl = await listen(async () => ({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "Connection": "keep-alive",
      },
      body: (async function* () {
        yield "event: progress\ndata: {\"completed\":1,\"total\":2}\n\n";
        await finalReady;
        yield "event: progress\ndata: {\"completed\":2,\"total\":2}\n\n";
      })(),
    }));

    const response = await fetch(`${baseUrl}/season-simulations`, { method: "POST" });
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store, no-transform");
    expect(response.headers.get("connection")).toBe("keep-alive");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const reader = response.body?.getReader();
    if (reader === undefined) throw new Error("Expected a streamed response body.");
    const decoder = new TextDecoder();

    const first = await reader.read();
    expect(decoder.decode(first.value)).toBe(
      "event: progress\ndata: {\"completed\":1,\"total\":2}\n\n",
    );

    releaseFinal();
    const second = await reader.read();
    expect(decoder.decode(second.value)).toBe(
      "event: progress\ndata: {\"completed\":2,\"total\":2}\n\n",
    );
    await expect(reader.read()).resolves.toMatchObject({ done: true });
  });

  it("aborts a platform request when its client disconnects", async () => {
    let requestStarted!: () => void;
    const started = new Promise<void>(resolve => {
      requestStarted = resolve;
    });
    let requestAborted!: () => void;
    const aborted = new Promise<void>(resolve => {
      requestAborted = resolve;
    });
    const baseUrl = await listen(async request => {
      requestStarted();
      if (request.signal?.aborted === true) requestAborted();
      else request.signal?.addEventListener("abort", requestAborted, { once: true });
      await aborted;
      return { status: 499, body: { canceled: true } };
    });
    const clientRequest = httpRequest(`${baseUrl}/season-simulations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    clientRequest.on("error", () => undefined);
    clientRequest.end(JSON.stringify({ seasonId: "season-1", count: 25 }));
    await started;

    clientRequest.destroy();

    await expect(Promise.race([
      aborted.then(() => undefined),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request was not aborted.")), 100)),
    ])).resolves.toBeUndefined();
  });

  it("aborts a streamed platform request when its client disconnects after progress", async () => {
    let requestAborted!: () => void;
    const aborted = new Promise<void>(resolve => {
      requestAborted = resolve;
    });
    const baseUrl = await listen(async request => ({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      body: (async function* () {
        yield "event: progress\ndata: {\"completed\":1,\"total\":25}\n\n";
        if (request.signal?.aborted === true) requestAborted();
        else request.signal?.addEventListener("abort", requestAborted, { once: true });
        await aborted;
      })(),
    }));
    const clientRequest = httpRequest(`${baseUrl}/season-simulations`, { method: "POST" });
    clientRequest.on("error", () => undefined);
    clientRequest.on("response", clientResponse => {
      clientResponse.once("data", () => clientResponse.destroy());
    });
    clientRequest.end();

    await expect(Promise.race([
      aborted.then(() => undefined),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Stream was not aborted.")), 100)),
    ])).resolves.toBeUndefined();
  });

  it("ignores proxy client-address headers unless the proxy is explicitly trusted", async () => {
    const seenRequests: PlatformHttpRequest[] = [];
    const baseUrl = await listen(async request => {
      seenRequests.push(request);

      return { status: 200, body: { ok: true } };
    });

    await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "198.51.100.17",
        forwarded: "for=198.51.100.18",
        "x-forwarded-for": "198.51.100.19",
        "x-real-ip": "198.51.100.20",
      },
      body: JSON.stringify({ email: "cam@example.com", password: "secure password" }),
    });

    expect(seenRequests[0]?.clientAddress).toBe("127.0.0.1");
  });

  it("uses a validated proxy client address when the proxy is explicitly trusted", async () => {
    const seenRequests: PlatformHttpRequest[] = [];
    const baseUrl = await listen(async request => {
      seenRequests.push(request);

      return { status: 200, body: { ok: true } };
    }, { trustProxy: true });

    await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "198.51.100.17",
        forwarded: "for=198.51.100.18;proto=https",
        "x-forwarded-for": "198.51.100.19, 10.0.0.8",
      },
      body: JSON.stringify({ email: "cam@example.com", password: "secure password" }),
    });

    expect(seenRequests[0]?.clientAddress).toBe("198.51.100.17");
  });

  it("falls back to the socket address for malformed trusted-proxy headers", async () => {
    const seenRequests: PlatformHttpRequest[] = [];
    const baseUrl = await listen(async request => {
      seenRequests.push(request);

      return { status: 200, body: { ok: true } };
    }, { trustProxy: true });

    await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "attacker-controlled-value",
        forwarded: "for=attacker-controlled-value",
        "x-forwarded-for": "198.51.100.19",
      },
      body: JSON.stringify({ email: "cam@example.com", password: "secure password" }),
    });

    expect(seenRequests[0]?.clientAddress).toBe("127.0.0.1");
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

  it("serves the React app shell with a restrictive browser security policy", async () => {
    const baseUrl = await listen(async () => ({ status: 200, body: { ok: true } }), {
      appHtml: "<!doctype html><title>Mockd app</title>",
    });

    const htmlResponse = await fetch(`${baseUrl}/login`);

    expect(htmlResponse.headers.get("content-security-policy")).toBe(
      "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; "
      + "style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; "
      + "font-src 'self'; connect-src 'self'; "
      + "form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; worker-src 'self' blob:",
    );
    expect(htmlResponse.headers.get("x-frame-options")).toBe("DENY");
    expect(htmlResponse.headers.get("referrer-policy")).toBe("no-referrer");
    expect(htmlResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(htmlResponse.headers.get("permissions-policy")).toBe(
      "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()",
    );
  });

  it("prevents API JSON responses from entering shared or browser caches", async () => {
    const baseUrl = await listen(async request => {
      if (request.path === "/explicit-cache-policy") {
        return {
          status: 200,
          headers: { "Cache-Control": "private, no-store, max-age=0" },
          body: { ok: true },
        };
      }
      if (request.path === "/unsafe-cache-policy") {
        return {
          status: 200,
          headers: { "Cache-Control": "public, max-age=3600" },
          body: { ok: true },
        };
      }

      return { status: 200, body: { ok: true } };
    });

    const defaultResponse = await fetch(`${baseUrl}/session`, {
      headers: { cookie: "mockd_session=private-session-token" },
    });
    const explicitResponse = await fetch(`${baseUrl}/explicit-cache-policy`);
    const unsafeResponse = await fetch(`${baseUrl}/unsafe-cache-policy`);

    expect(defaultResponse.headers.get("cache-control")).toBe("private, no-store");
    expect(defaultResponse.headers.get("referrer-policy")).toBe("no-referrer");
    expect(defaultResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(explicitResponse.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(unsafeResponse.headers.get("cache-control")).toBe("private, no-store");
  });

  it("preserves immutable caching for hashed browser assets", async () => {
    const browserAssets: ReadonlyMap<string, PlatformBrowserAsset> = new Map([
      ["/assets/app-a1b2c3.js", {
        body: Buffer.from("window.mockd = true;"),
        cacheControl: "public, max-age=31536000, immutable",
        contentType: "text/javascript; charset=utf-8",
      }],
    ]);
    const baseUrl = await listen(
      async () => ({ status: 404, body: { error: { code: "not_found" } } }),
      { browserAssets },
    );

    const response = await fetch(`${baseUrl}/assets/app-a1b2c3.js`);

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.headers.get("cache-control")).not.toContain("no-store");
  });

  it("marks platform requests as secure for directly HTTPS traffic", async () => {
    const seenRequests: PlatformHttpRequest[] = [];
    const baseUrl = await listenHttps(async request => {
      seenRequests.push(request);

      return { status: 200, body: { ok: true } };
    });

    const response = await httpsJsonFetch(baseUrl, "/session");

    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0]?.isSecure).toBe(true);
    expect(response.strictTransportSecurity).toBe("max-age=31536000; includeSubDomains");
  });

  it("does not advertise HSTS for plain HTTP or untrusted proxy headers", async () => {
    const baseUrl = await listen(async () => ({ status: 200, body: { ok: true } }));

    const response = await fetch(`${baseUrl}/session`, {
      headers: { "x-forwarded-proto": "https" },
    });

    expect(response.headers.get("strict-transport-security")).toBeNull();
  });

  it("advertises HSTS when an explicitly trusted proxy reports HTTPS", async () => {
    const baseUrl = await listen(
      async () => ({ status: 200, body: { ok: true } }),
      { trustProxy: true },
    );

    const response = await fetch(`${baseUrl}/session`, {
      headers: { "x-forwarded-proto": "https, http" },
    });

    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  it("serves one React app document from every product route", async () => {
    let callCount = 0;
    const appHtml = "<!doctype html><div id=\"root\"></div>";
    const baseUrl = await listen(async () => {
      callCount += 1;

      return { status: 404, body: { error: { code: "nope", message: "Nope." } } };
    }, { appHtml });

    for (const path of [
      "/login",
      "/signup",
      "/verify-email?token=test",
      "/forgot-password",
      "/reset-password?token=test",
      "/invite?token=test",
      "/setup",
      "/league",
      "/commissioner",
      "/practice",
      "/my-team",
      "/mock-drafts",
      "/draft-room",
    ]) {
      const response = await fetch(`${baseUrl}${path}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(await response.text()).toBe(appHtml);
    }

    expect(callCount).toBe(0);
  });

  it("redirects superseded product pages into the unified workspace", async () => {
    const baseUrl = await listen(async () => ({ status: 404, body: {} }), {
      appHtml: "<!doctype html><title>Mockd app</title>",
    });
    const cases = [
      ["/board?seasonId=season-1", "/practice?seasonId=season-1"],
      ["/board?contextSeasonId=season-legacy", "/practice?seasonId=season-legacy"],
      ["/simulations?seasonId=season-1&strategy=rb", "/practice?seasonId=season-1&strategy=rb"],
      ["/player-news?seasonId=season-1", "/practice?seasonId=season-1"],
      ["/strategy?seasonId=season-1", "/mock-drafts?seasonId=season-1"],
      ["/mock-results?seasonId=season-1", "/mock-drafts?seasonId=season-1"],
      ["/my-expert?seasonId=season-1", "/my-team?seasonId=season-1"],
      [
        "/setup?seasonId=season-1&section=keepers",
        "/commissioner?seasonId=season-1&section=keepers",
      ],
    ] as const;

    for (const [source, target] of cases) {
      const response = await fetch(`${baseUrl}${source}`, { redirect: "manual" });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(target);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
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

  it("uses the larger body limit only for screenshot analysis", async () => {
    const seenPaths: string[] = [];
    const baseUrl = await listen(async request => {
      seenPaths.push(request.path);
      return { status: 200, body: { ok: true } };
    }, {
      maxBodyBytes: 10,
      screenshotImportMaxBodyBytes: 100,
      screenshotImportPreflight: async () => null,
    });
    const body = JSON.stringify({ base64: "12345678901234567890" });

    const screenshot = await jsonFetch(
      baseUrl,
      "/seasons/season-1/setup-import/screenshot-analyze",
      { method: "POST", headers: { "content-type": "application/json" }, body },
    );
    const leagueCreationScreenshot = await jsonFetch(
      baseUrl,
      "/league-imports/espn/members-screenshot-review",
      { method: "POST", headers: { "content-type": "application/json" }, body },
    );
    const historicalSpreadsheet = await jsonFetch(
      baseUrl,
      "/seasons/season-1/historical-imports/upload-preview",
      { method: "POST", headers: { "content-type": "application/json" }, body },
    );
    const ordinary = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    expect(screenshot.status).toBe(200);
    expect(leagueCreationScreenshot.status).toBe(200);
    expect(historicalSpreadsheet.status).toBe(200);
    expect(ordinary.status).toBe(413);
    expect(seenPaths).toEqual([
      "/seasons/season-1/setup-import/screenshot-analyze",
      "/league-imports/espn/members-screenshot-review",
      "/seasons/season-1/historical-imports/upload-preview",
    ]);
  });

  it("rejects screenshot uploads before consuming the body or calling the handler", async () => {
    let handlerCallCount = 0;
    let preflightRequest: PlatformHttpRequest | undefined;
    const baseUrl = await listen(async () => {
      handlerCallCount += 1;
      return { status: 200, body: { ok: true } };
    }, {
      screenshotImportPreflight: async request => {
        preflightRequest = request;
        return {
          status: 401,
          body: { error: { code: "auth_required", message: "Sign in first." } },
        };
      },
    });

    const pending = await requestBeforeSendingBody(
      baseUrl,
      "/seasons/season-1/setup-import/screenshot-analyze",
    );
    pending.request.destroy();

    expect(pending.response).toEqual({
      status: 401,
      body: { error: { code: "auth_required", message: "Sign in first." } },
    });
    expect(handlerCallCount).toBe(0);
    expect(preflightRequest).toMatchObject({
      method: "POST",
      path: "/seasons/season-1/setup-import/screenshot-analyze",
    });
    expect(preflightRequest).not.toHaveProperty("body");
  });

  it("releases historical import admission after malformed request bodies", async () => {
    let activeAdmissions = 0;
    let releases = 0;
    const baseUrl = await listen(async () => ({ status: 200, body: { ok: true } }), {
      historicalImportPreflight: async () => {
        activeAdmissions += 1;
        if (activeAdmissions > 1) {
          return {
            status: 429,
            body: { error: { code: "historical_import_busy", message: "Try again later." } },
          };
        }

        return {
          release: () => {
            activeAdmissions -= 1;
            releases += 1;
          },
        };
      },
    });
    const path = "/seasons/season-1/historical-imports/upload-preview";

    await expect(jsonFetch(baseUrl, path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "invalid_json" } },
    });
    await expect(jsonFetch(baseUrl, path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "draft.csv" }),
    })).resolves.toMatchObject({ status: 200 });
    expect(activeAdmissions).toBe(0);
    expect(releases).toBe(2);
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
