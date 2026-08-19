import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryPlayerNewsRepository } from "../src/platform/playerNews.js";
import { createGlobalPlayerNewsHandler } from "../src/platform/platformServer/globalPlayerNews.js";
import { stubReportingFeed } from "./support/reportingFeed.js";

const servers: Server[] = [];

const listen = async (
  handler: (request: Parameters<ReturnType<typeof createGlobalPlayerNewsHandler>>[0], response: Parameters<ReturnType<typeof createGlobalPlayerNewsHandler>>[1]) => Promise<boolean>,
): Promise<string> => {
  const server = createServer(async (request, response) => {
    if (await handler(request, response)) return;
    response.writeHead(418, { "content-type": "application/json" });
    response.end(JSON.stringify({ handledBy: "draft-tools" }));
  });
  servers.push(server);
  await new Promise<void>(resolve => { server.listen(0, "127.0.0.1", resolve); });
  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
};

const newsHandler = (options: {
  repository?: InMemoryPlayerNewsRepository;
  catalog?: () => Promise<{ name: string; position: string }[]>;
} = {}) => createGlobalPlayerNewsHandler(
  {
    current: () => ({
      app: { findAccountBySessionToken: async () => ({ id: "account-owner11" }) },
      playerNewsRepository: options.repository ?? new InMemoryPlayerNewsRepository(),
    }),
  } as never,
  {
    currentPlayerCatalogProvider: options.catalog ?? (async () => []),
  } as never,
);

describe("global player news handler", () => {
  beforeEach(() => { stubReportingFeed(); });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all(servers.splice(0).map(server =>
      new Promise<void>(resolve => { server.close(() => { resolve(); }); })));
  });

  it("serves league-scoped news without starting private draft tools", async () => {
    const baseUrl = await listen(newsHandler());

    const response = await fetch(
      `${baseUrl}/api/player-news?seasonId=season-fd6519d7&source=local`,
      { headers: { cookie: "mockd_session=token-owner11" } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: expect.any(Array) });
  });

  it("never publishes the pricing evidence rows as news", async () => {
    const baseUrl = await listen(newsHandler());

    const response = await fetch(`${baseUrl}/api/player-news?source=local`, {
      headers: { cookie: "mockd_session=token-owner11" },
    });
    const feed = await response.json() as { items: { source: { provider: string } }[] };

    expect(response.status).toBe(200);
    expect(feed.items.filter(item => item.source.provider === "Local evidence")).toEqual([]);
  });

  it("reads stored news instead of fetching a feed while a reader waits", async () => {
    // Pulling RotoWire and writing a row per item on the request path is what
    // made the page fall over under concurrent readers; the refresh loop owns
    // that work now.
    const repository = new InMemoryPlayerNewsRepository();
    const saveItems = vi.spyOn(repository, "saveItems");
    const outboundHosts: string[] = [];
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = typeof input === "string"
        ? input
        : input instanceof URL ? input.href : input.url;
      if (!target.includes("127.0.0.1")) outboundHosts.push(target);
      return await realFetch(input, init);
    });
    const baseUrl = await listen(newsHandler({ repository }));

    const response = await fetch(`${baseUrl}/api/player-news`, {
      headers: { cookie: "mockd_session=token-owner11" },
    });

    expect(response.status).toBe(200);
    expect(outboundHosts).toEqual([]);
    expect(saveItems).not.toHaveBeenCalled();
  });

  it("retries the player catalog after it fails once", async () => {
    // The catalog promise is memoized across requests. A rejected promise stays
    // rejected, so caching it would 500 every later request until a redeploy.
    let attempts = 0;
    const baseUrl = await listen(newsHandler({
      catalog: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("catalog unavailable");
        return [{ name: "De'Von Achane", position: "RB" }];
      },
    }));
    const get = async () => await fetch(`${baseUrl}/api/player-news`, {
      headers: { cookie: "mockd_session=token-owner11" },
    });

    const first = await get();
    const second = await get();
    const third = await get();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    // The retry that succeeded is cached, so a healthy catalog is read once.
    expect(attempts).toBe(2);
  });

  it("still serves news when no league is selected", async () => {
    const baseUrl = await listen(newsHandler());

    const response = await fetch(`${baseUrl}/api/player-news?source=local`, {
      headers: { cookie: "mockd_session=token-owner11" },
    });

    expect(response.status).toBe(200);
  });
});
