import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createFantasyProsClient,
  parseFantasyProsNews,
  type FantasyProsFetch,
} from "../src/data/fantasyPros.js";
import { rawItemFromFantasyProsNews } from "../src/data/fantasyProsNewsAdapter.js";

const newsFixture: unknown = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/fantasyPros/news.json"), "utf8"),
);

const okResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });

describe("FantasyPros news", () => {
  it("reads every item out of a real news payload", () => {
    const items = parseFantasyProsNews(newsFixture);

    expect(items.length).toBe(23);
    expect(items[0]).toMatchObject({
      itemId: 603053,
      playerId: 16393,
      teamAbbreviation: "SF",
      title: "Christian McCaffrey would have practiced if it wasn't joint practice",
      categories: ["Commentary", "News", "Injury"],
    });
    expect(items[0]?.impact).toContain("day-to-day");
  });

  it("reads the zoneless timestamp as UTC rather than local time", () => {
    // FantasyPros publishes "2026-08-18 20:14:37" with no zone marker. Left to
    // Date.parse that is local time, which moves every item by hours.
    const [item] = parseFantasyProsNews({
      items: [{ id: 1, created: "2026-08-18 20:14:37", title: "A headline", desc: "" }],
    });

    expect(item?.createdAt).toBe("2026-08-18T20:14:37.000Z");
  });

  it("drops a record with no id, no title, or an unparseable timestamp", () => {
    const items = parseFantasyProsNews({
      items: [
        { created: "2026-08-18 20:14:37", title: "No id" },
        { id: 2, created: "2026-08-18 20:14:37", title: "" },
        { id: 3, created: "not a date", title: "Bad timestamp" },
        { id: 4, created: "2026-08-18 20:14:37", title: "Kept" },
      ],
    });

    expect(items.map(item => item.itemId)).toEqual([4]);
  });

  it("returns nothing for a payload that carries no items at all", () => {
    expect(parseFantasyProsNews({ count: 0 })).toEqual([]);
    expect(parseFantasyProsNews("not an object")).toEqual([]);
  });

  it("requests the unversioned news path, because the season-scoped one 403s", async () => {
    const fetchImplementation = vi.fn<FantasyProsFetch>(async () => okResponse(newsFixture));
    const client = createFantasyProsClient({ apiKey: "test-key", fetchImplementation });

    await client.fetchNews({ limit: 25 });

    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(url).toBe("https://api.fantasypros.com/public/v2/json/nfl/news?limit=25");
    expect(init?.headers).toMatchObject({ "x-api-key": "test-key" });
  });

  it("asks for a default page size when the caller names none", async () => {
    const fetchImplementation = vi.fn<FantasyProsFetch>(async () => okResponse({ items: [] }));
    const client = createFantasyProsClient({ apiKey: "test-key", fetchImplementation });

    await client.fetchNews();

    expect(fetchImplementation.mock.calls[0]?.[0]).toContain("limit=50");
  });

  it("reports an upstream failure instead of serving an empty feed", async () => {
    const client = createFantasyProsClient({
      apiKey: "test-key",
      fetchImplementation: async () => new Response("nope", { status: 503 }),
    });

    await expect(client.fetchNews()).rejects.toThrow("failed with 503");
  });
});

describe("FantasyPros news adapter", () => {
  const fetchedAt = "2026-08-18T21:00:00.000Z";
  const mcCaffrey = parseFantasyProsNews(newsFixture).find(item => item.itemId === 603053);
  if (mcCaffrey === undefined) throw new Error("Fixture must include news item 603053.");

  it("carries the structured fields RotoWire has no equivalent for", () => {
    const raw = rawItemFromFantasyProsNews(mcCaffrey, fetchedAt, () => "Christian McCaffrey");

    expect(raw).toMatchObject({
      provider: "fantasypros",
      providerItemId: "603053",
      playerName: "Christian McCaffrey",
      providerPlayerId: "16393",
      providerTeamAbbreviation: "SF",
      categories: ["Commentary", "News", "Injury"],
      publishedAt: "2026-08-18T20:14:37.000Z",
      fetchedAt,
    });
    expect(raw.analystImpact).toContain("day-to-day");
  });

  it("leaves the player unnamed when the catalog cannot resolve the id", () => {
    const raw = rawItemFromFantasyProsNews(
      { itemId: 1, createdAt: fetchedAt, title: "Someone did something", description: "", categories: [], playerId: 99 },
      fetchedAt,
      () => undefined,
    );

    expect(raw.playerName).toBeUndefined();
    expect(raw.providerPlayerId).toBe("99");
  });

  it("still derives tags so a FantasyPros item filters like any other", () => {
    const raw = rawItemFromFantasyProsNews(
      { itemId: 1, createdAt: fetchedAt, title: "Player suffers hamstring injury", description: "", categories: [] },
      fetchedAt,
      () => "Player",
    );

    expect(raw.tags).toContain("Injury");
  });
});
