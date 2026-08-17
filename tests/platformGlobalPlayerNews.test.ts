import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryPlayerNewsRepository } from "../src/platform/playerNews.js";
import { createGlobalPlayerNewsHandler } from "../src/platform/platformServer/globalPlayerNews.js";

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

const newsHandler = () => createGlobalPlayerNewsHandler(
  {
    current: () => ({
      app: { findAccountBySessionToken: async () => ({ id: "account-owner11" }) },
      playerNewsRepository: new InMemoryPlayerNewsRepository(),
    }),
  } as never,
  { currentPlayerCatalogProvider: async () => [] } as never,
);

describe("global player news handler", () => {
  afterEach(async () => {
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

  it("still serves news when no league is selected", async () => {
    const baseUrl = await listen(newsHandler());

    const response = await fetch(`${baseUrl}/api/player-news?source=local`, {
      headers: { cookie: "mockd_session=token-owner11" },
    });

    expect(response.status).toBe(200);
  });
});
