import { describe, expect, it } from "vitest";
import { InMemoryPlayerNewsRepository } from "../src/platform/playerNews.js";

describe("in-memory player news repository", () => {
  it("upserts on provider and provider item id instead of duplicating", async () => {
    const repository = new InMemoryPlayerNewsRepository();
    const now = new Date("2026-08-17T12:00:00.000Z");
    await repository.saveItems([{
      provider: "rotowire-rss",
      providerItemId: "item-1",
      title: "Original headline",
      summary: "Original summary.",
      fetchedAt: now.toISOString(),
      tags: ["News"],
    }]);
    await repository.saveItems([{
      provider: "rotowire-rss",
      providerItemId: "item-1",
      title: "Updated headline",
      summary: "Updated summary.",
      fetchedAt: now.toISOString(),
      tags: ["Injury"],
    }]);

    const items = await repository.recentItems(now);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Updated headline", tags: ["Injury"] });
  });

  it("treats the same provider item id from a different provider as a separate item", async () => {
    const repository = new InMemoryPlayerNewsRepository();
    const now = new Date("2026-08-17T12:00:00.000Z");
    await repository.saveItems([
      {
        provider: "rotowire-rss", providerItemId: "shared-id", title: "RotoWire item",
        summary: "s", fetchedAt: now.toISOString(), tags: ["News"],
      },
      {
        provider: "espn", providerItemId: "shared-id", title: "ESPN item",
        summary: "s", fetchedAt: now.toISOString(), tags: ["News"],
      },
    ]);

    const items = await repository.recentItems(now);
    expect(items).toHaveLength(2);
  });

  it("returns only items published or fetched within the retention window, newest first", async () => {
    const repository = new InMemoryPlayerNewsRepository();
    const now = new Date("2026-08-17T12:00:00.000Z");
    await repository.saveItems([
      {
        provider: "rotowire-rss", providerItemId: "recent", title: "Recent",
        summary: "s", publishedAt: "2026-08-16T12:00:00.000Z", fetchedAt: now.toISOString(), tags: ["News"],
      },
      {
        provider: "rotowire-rss", providerItemId: "stale", title: "Stale",
        summary: "s", publishedAt: "2026-08-01T12:00:00.000Z", fetchedAt: now.toISOString(), tags: ["News"],
      },
      {
        provider: "rotowire-rss", providerItemId: "newest", title: "Newest",
        summary: "s", publishedAt: "2026-08-17T06:00:00.000Z", fetchedAt: now.toISOString(), tags: ["News"],
      },
    ]);

    const items = await repository.recentItems(now);
    expect(items.map(item => item.title)).toEqual(["Newest", "Recent"]);
  });

  it("falls back to fetchedAt when an item has no publish date", async () => {
    const repository = new InMemoryPlayerNewsRepository();
    const now = new Date("2026-08-17T12:00:00.000Z");
    await repository.saveItems([{
      provider: "espn", providerItemId: "undated", title: "Undated",
      summary: "s", fetchedAt: now.toISOString(), tags: ["News"],
    }]);

    const items = await repository.recentItems(now);
    expect(items).toHaveLength(1);
  });

  it("deletes only items older than the retention window and reports how many", async () => {
    const repository = new InMemoryPlayerNewsRepository();
    const now = new Date("2026-08-17T12:00:00.000Z");
    await repository.saveItems([
      {
        provider: "rotowire-rss", providerItemId: "recent", title: "Recent",
        summary: "s", publishedAt: "2026-08-16T12:00:00.000Z", fetchedAt: now.toISOString(), tags: ["News"],
      },
      {
        provider: "rotowire-rss", providerItemId: "stale", title: "Stale",
        summary: "s", publishedAt: "2026-08-01T12:00:00.000Z", fetchedAt: now.toISOString(), tags: ["News"],
      },
    ]);

    const removed = await repository.deleteOlderThanRetention(now);
    expect(removed).toBe(1);
    expect((await repository.recentItems(now)).map(item => item.title)).toEqual(["Recent"]);
  });
});
