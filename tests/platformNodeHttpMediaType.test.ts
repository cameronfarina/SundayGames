import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import type { PlatformHttpHandler } from "../src/platform/platformHttp.js";
import { createPlatformNodeHttpAdapter } from "../src/platform/platformNodeHttp.js";

let server: ReturnType<typeof createServer> | undefined;
const listen = async (handle: PlatformHttpHandler): Promise<string> => {
  server = createServer(createPlatformNodeHttpAdapter(handle, {
    historicalImportPreflight: async () => ({ release: () => undefined }),
    screenshotImportPreflight: async () => null,
  }));
  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected a TCP test address.");
  }
  return `http://127.0.0.1:${address.port}`;
};
afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    if (server === undefined) return resolve();
    server.close(error => {
      server = undefined;
      if (error === undefined) resolve();
      else reject(error);
    });
  });
});

describe("platform Node HTTP JSON media types", () => {
  it("rejects a cross-site text form before it can replace the session", async () => {
    let handlerCalls = 0;
    const origin = await listen(async () => {
      handlerCalls += 1;
      return {
        status: 200,
        headers: { "Set-Cookie": "mockd_session=attacker; Path=/" },
        body: { authenticated: true },
      };
    });
    const response = await fetch(`${origin}/sessions`, {
      method: "POST",
      headers: {
        cookie: "mockd_session=victim",
        "content-type": "text/plain",
        origin: "https://attacker.example",
      },
      body: JSON.stringify({ email: "attacker@example.com", password: "known" }),
    });
    expect(response.status).toBe(415);
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unsupported_media_type",
        message: "Request body must use application/json.",
      },
    });
    expect(handlerCalls).toBe(0);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "rejects body-bearing %s requests without a JSON media type",
    async method => {
      let handlerCalls = 0;
      const origin = await listen(async () => {
        handlerCalls += 1;
        return { status: 200, body: { ok: true } };
      });
      const response = await fetch(`${origin}/mutation`, {
        method,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "value=1",
      });
      expect(response.status).toBe(415);
      expect(handlerCalls).toBe(0);
    },
  );

  it.each([
    "application/json",
    "application/json; charset=utf-8",
    "Application/JSON ; Charset=\"UTF-8\"",
  ])("accepts supported JSON content type %s", async contentType => {
    const seenBodies: unknown[] = [];
    const origin = await listen(async request => {
      seenBodies.push(request.body);
      return { status: 200, body: { ok: true } };
    });
    const response = await fetch(`${origin}/sessions`, {
      method: "POST",
      headers: { "content-type": contentType },
      body: JSON.stringify({ email: "cam@example.com" }),
    });
    expect(response.status).toBe(200);
    expect(seenBodies).toEqual([{ email: "cam@example.com" }]);
  });

  it("keeps JSON-wrapped screenshot and spreadsheet uploads functional", async () => {
    const seenPaths: string[] = [];
    const origin = await listen(async request => {
      seenPaths.push(request.path);
      return { status: 200, body: { ok: true } };
    });
    const init = {
      method: "POST",
      headers: { "content-type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ fileName: "draft.csv", base64: "ZmlsZQ==" }),
    };
    const screenshot = await fetch(
      `${origin}/seasons/season-1/setup-import/screenshot-analyze`,
      init,
    );
    const spreadsheet = await fetch(
      `${origin}/seasons/season-1/historical-imports/upload-preview`,
      init,
    );
    expect([screenshot.status, spreadsheet.status]).toEqual([200, 200]);
    expect(seenPaths).toEqual([
      "/seasons/season-1/setup-import/screenshot-analyze",
      "/seasons/season-1/historical-imports/upload-preview",
    ]);
  });

  it("leaves bodyless mutations, reads, and preflight requests unchanged", async () => {
    const seen: string[] = [];
    const origin = await listen(async request => {
      seen.push(`${request.method} ${request.path}`);
      return { status: 200, body: { ok: true } };
    });
    const responses = await Promise.all([
      fetch(`${origin}/sessions/logout`, { method: "POST" }),
      fetch(`${origin}/healthz`),
      fetch(`${origin}/sessions`, { method: "OPTIONS" }),
    ]);
    expect(responses.map(response => response.status)).toEqual([200, 200, 200]);
    expect(seen).toEqual([
      "POST /sessions/logout",
      "GET /healthz",
      "OPTIONS /sessions",
    ]);
  });
});
