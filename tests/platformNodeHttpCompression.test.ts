import { Buffer } from "node:buffer";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type Server,
} from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import type { PlatformHttpHandler } from "../src/platform/platformHttp.js";
import { createPlatformNodeHttpAdapter } from "../src/platform/platformNodeHttp.js";
import type { PlatformBrowserAsset } from "../src/platform/platformStaticWebAssets.js";

interface TestResponse {
  readonly body: Buffer;
  readonly headers: IncomingHttpHeaders;
  readonly status: number;
}

let server: Server | undefined;
type AdapterOptions = NonNullable<Parameters<typeof createPlatformNodeHttpAdapter>[1]>;

afterEach(async () => {
  if (server === undefined) return;
  await new Promise<void>((resolve, reject) => {
    server?.close(error => error === undefined ? resolve() : reject(error));
  });
  server = undefined;
});

const listen = async (
  handle: PlatformHttpHandler,
  options: AdapterOptions = {},
): Promise<string> => {
  server = createServer(createPlatformNodeHttpAdapter(handle, options));
  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected TCP test server address.");
  }

  return `http://127.0.0.1:${address.port}`;
};

const request = async (
  url: string,
  headers: Readonly<Record<string, string>>,
  method = "GET",
): Promise<TestResponse> => await new Promise((resolve, reject) => {
  const outgoingRequest = httpRequest(url, { headers, method }, incomingResponse => {
    const chunks: Buffer[] = [];
    incomingResponse.on("data", chunk => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    incomingResponse.on("end", () => {
      resolve({
        body: Buffer.concat(chunks),
        headers: incomingResponse.headers,
        status: incomingResponse.statusCode ?? 0,
      });
    });
  });
  outgoingRequest.once("error", reject);
  outgoingRequest.end();
});

describe("platform HTTP compression", () => {
  it("prefers Brotli for large JSON when the client accepts Brotli and gzip", async () => {
    const payload = {
      players: Array.from({ length: 500 }, (_, index) => ({
        id: `player-${index}`,
        name: `Player ${index}`,
        position: "WR",
      })),
    };
    const serializedPayload = JSON.stringify(payload);
    const baseUrl = await listen(async () => ({ status: 200, body: payload }));

    const response = await request(`${baseUrl}/player-catalog`, {
      "accept-encoding": "gzip, br",
    });

    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBe("br");
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(response.headers["content-length"]).toBe(String(response.body.byteLength));
    expect(brotliDecompressSync(response.body).toString("utf8")).toBe(serializedPayload);
    expect(response.body.byteLength).toBeLessThan(Buffer.byteLength(serializedPayload));
  });

  it("uses gzip when the client gives gzip a higher quality", async () => {
    const payload = { results: "auction-result-".repeat(500) };
    const serializedPayload = JSON.stringify(payload);
    const baseUrl = await listen(async () => ({ status: 200, body: payload }));

    const response = await request(`${baseUrl}/season-simulations`, {
      "accept-encoding": "br;q=0.4, gzip;q=0.9",
    });

    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(response.headers["content-length"]).toBe(String(response.body.byteLength));
    expect(gunzipSync(response.body).toString("utf8")).toBe(serializedPayload);
  });

  it("falls back to identity when supported encodings are disabled", async () => {
    const payload = { catalog: "player-value-".repeat(500) };
    const serializedPayload = JSON.stringify(payload);
    const baseUrl = await listen(async () => ({ status: 200, body: payload }));

    const response = await request(`${baseUrl}/player-catalog`, {
      "accept-encoding": "br;q=0, gzip;q=0, deflate;q=1",
    });

    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(response.headers["content-length"]).toBe(String(Buffer.byteLength(serializedPayload)));
    expect(response.body.toString("utf8")).toBe(serializedPayload);
  });

  it("honors an explicitly preferred identity representation", async () => {
    const payload = { catalog: "player-value-".repeat(500) };
    const serializedPayload = JSON.stringify(payload);
    const baseUrl = await listen(async () => ({ status: 200, body: payload }));

    const response = await request(`${baseUrl}/player-catalog`, {
      "accept-encoding": "identity;q=1, br;q=0.8, gzip;q=0.7",
    });

    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(response.body.toString("utf8")).toBe(serializedPayload);
  });

  it("does not compress event streams", async () => {
    const event = `event: progress\ndata: ${"x".repeat(2_000)}\n\n`;
    const baseUrl = await listen(async () => ({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      body: event,
    }));

    const response = await request(`${baseUrl}/season-simulations`, {
      "accept-encoding": "br, gzip",
    });

    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers.vary).toBeUndefined();
    expect(response.body.toString("utf8")).toBe(event);
  });

  it("serves one Brotli representation for static asset GET and HEAD requests", async () => {
    const source = Buffer.from("window.mockdPlayer = true;\n".repeat(500));
    const browserAssets: ReadonlyMap<string, PlatformBrowserAsset> = new Map([
      ["/assets/app-a1b2c3.js", {
        body: source,
        cacheControl: "public, max-age=31536000, immutable",
        contentType: "text/javascript; charset=utf-8",
      }],
    ]);
    const baseUrl = await listen(async () => ({ status: 404, body: {} }), { browserAssets });
    const headers = { "accept-encoding": "br, gzip" };

    const getResponse = await request(`${baseUrl}/assets/app-a1b2c3.js`, headers);
    const headResponse = await request(`${baseUrl}/assets/app-a1b2c3.js`, headers, "HEAD");

    expect(getResponse.headers["content-encoding"]).toBe("br");
    expect(getResponse.headers.vary).toBe("Accept-Encoding");
    expect(getResponse.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(getResponse.headers["x-content-type-options"]).toBe("nosniff");
    expect(getResponse.headers["referrer-policy"]).toBe("no-referrer");
    expect(getResponse.headers["content-length"]).toBe(String(getResponse.body.byteLength));
    expect(brotliDecompressSync(getResponse.body)).toEqual(source);
    expect(headResponse.headers["content-encoding"]).toBe("br");
    expect(headResponse.headers["content-length"]).toBe(String(getResponse.body.byteLength));
    expect(headResponse.body.byteLength).toBe(0);
  });

  it("does not compress already-compressed static formats", async () => {
    const pngBody = Buffer.alloc(10_000, 7);
    const browserAssets: ReadonlyMap<string, PlatformBrowserAsset> = new Map([
      ["/assets/player.png", {
        body: pngBody,
        cacheControl: "public, max-age=31536000, immutable",
        contentType: "image/png",
      }],
    ]);
    const baseUrl = await listen(async () => ({ status: 404, body: {} }), { browserAssets });

    const response = await request(`${baseUrl}/assets/player.png`, {
      "accept-encoding": "br, gzip",
    });

    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers.vary).toBeUndefined();
    expect(response.headers["content-length"]).toBe(String(pngBody.byteLength));
    expect(response.body).toEqual(pngBody);
  });

  it("does not compress bodies below the minimum useful size", async () => {
    const payload = { ok: true };
    const serializedPayload = JSON.stringify(payload);
    const baseUrl = await listen(async () => ({ status: 200, body: payload }));

    const response = await request(`${baseUrl}/healthz`, {
      "accept-encoding": "br, gzip",
    });

    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers.vary).toBeUndefined();
    expect(response.headers["content-length"]).toBe(String(Buffer.byteLength(serializedPayload)));
    expect(response.body.toString("utf8")).toBe(serializedPayload);
  });
});
