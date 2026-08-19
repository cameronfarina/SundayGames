import { describe, expect, it } from "vitest";
import type { RawPlayerNewsItem } from "../src/data/playerNewsProviderAdapters.js";
import { buildPlayerNewsFeed, type PlayerNewsFilters } from "../src/modeling/playerNews.js";

type RawItemOverrides = Partial<RawPlayerNewsItem>;

/** exactOptionalPropertyTypes forbids passing undefined, so absence is removal. */
const without = (
  item: RawPlayerNewsItem,
  ...keys: readonly ("playerName" | "providerPlayerId" | "publishedAt")[]
): RawPlayerNewsItem => {
  const copy = { ...item };
  for (const key of keys) delete copy[key];
  return copy;
};

const emptyDraftState = { availableTargets: [], events: [], owners: [] };

const feedFor = (
  rawNewsItems: readonly RawPlayerNewsItem[],
  filters: PlayerNewsFilters = {},
) => buildPlayerNewsFeed({ draftState: emptyDraftState, filters, rawNewsItems });

const fantasyProsItem = (overrides: RawItemOverrides = {}): RawPlayerNewsItem => ({
  provider: "fantasypros",
  providerItemId: "603053",
  canonicalUrl: "https://www.fantasypros.com/nfl/news/603053.php",
  playerName: "Christian McCaffrey",
  title: "Christian McCaffrey would have practiced Tuesday",
  summary: "Kyle Shanahan said McCaffrey would have practiced on Tuesday.",
  publishedAt: "2026-08-18T20:14:37.000Z",
  fetchedAt: "2026-08-18T21:00:00.000Z",
  tags: ["Practice"],
  categories: ["Commentary", "News", "Injury"],
  analystImpact: "McCaffrey remains day-to-day",
  providerPlayerId: "16393",
  providerTeamAbbreviation: "SF",
  raw: undefined,
  ...overrides,
});

const rotowireItem = (overrides: RawItemOverrides = {}): RawPlayerNewsItem => ({
  provider: "rotowire-rss",
  providerItemId: "rw-1",
  playerName: "Christian McCaffrey",
  title: "Would have practiced Tuesday",
  summary: "McCaffrey would have practiced on Tuesday, per Kyle Shanahan.",
  publishedAt: "2026-08-18T20:40:00.000Z",
  fetchedAt: "2026-08-18T21:00:00.000Z",
  tags: ["Practice"],
  raw: undefined,
  ...overrides,
});

describe("FantasyPros items in the player news feed", () => {
  it("carries the categories, the analyst take, and the provider's own team", () => {
    const [item] = feedFor([fantasyProsItem()]).items;

    expect(item).toMatchObject({
      analystImpact: "McCaffrey remains day-to-day.",
      categories: ["Commentary", "News", "Injury"],
      teamAbbreviation: "SF",
      source: { provider: "FantasyPros" },
    });
  });

  it("shows the most actionable label the provider applied, not the first", () => {
    // FantasyPros files a torn ACL under Commentary, News, and Injury.
    expect(feedFor([fantasyProsItem()]).items[0]?.category).toBe("Injury");
  });

  it("falls back to the derived tag when a provider labels nothing", () => {
    expect(feedFor([rotowireItem()]).items[0]?.category).toBe("Practice");
  });

  it("does not print the player's name twice in a FantasyPros headline", () => {
    // RotoWire splits the name off the front of its title and the feed puts it
    // back; FantasyPros leaves it in place.
    expect(feedFor([fantasyProsItem()]).items[0]?.headline)
      .toBe("Christian McCaffrey would have practiced Tuesday.");
    expect(feedFor([rotowireItem()]).items[0]?.headline)
      .toBe("Christian McCaffrey: Would have practiced Tuesday.");
  });

  it("leaves the FantasyPros-only fields off a RotoWire item", () => {
    const [item] = feedFor([rotowireItem()]).items;

    expect(item?.categories).toBeUndefined();
    expect(item?.analystImpact).toBeUndefined();
  });

  it("narrows to one provider when the source filter names it", () => {
    const feed = feedFor([fantasyProsItem(), rotowireItem()], { source: "rotowire-rss" });

    expect(feed.items.map(item => item.source.provider)).toEqual(["RotoWire RSS"]);
  });
});

describe("duplicate reports across providers", () => {
  it("keeps the FantasyPros copy when both desks report the same event", () => {
    const feed = feedFor([fantasyProsItem(), rotowireItem()]);

    expect(feed.items.length).toBe(1);
    expect(feed.items[0]?.source.provider).toBe("FantasyPros");
    expect(feed.summary.totalCount).toBe(1);
  });

  it("collapses the pair whichever order they arrive in", () => {
    const feed = feedFor([rotowireItem(), fantasyProsItem()]);

    expect(feed.items.length).toBe(1);
    expect(feed.items[0]?.source.provider).toBe("FantasyPros");
  });

  it("keeps a follow-up from the same desk, which is a real update", () => {
    const feed = feedFor([
      rotowireItem(),
      rotowireItem({ providerItemId: "rw-2", publishedAt: "2026-08-18T20:50:00.000Z" }),
    ]);

    expect(feed.items.length).toBe(2);
  });

  it("keeps two reports about one player written hours apart", () => {
    const feed = feedFor([
      fantasyProsItem(),
      rotowireItem({ publishedAt: "2026-08-19T09:00:00.000Z" }),
    ]);

    expect(feed.items.length).toBe(2);
  });

  it("keeps different news about the same player at the same time", () => {
    const feed = feedFor([
      fantasyProsItem(),
      rotowireItem({ title: "Signs a three-year extension with the 49ers" }),
    ]);

    expect(feed.items.length).toBe(2);
  });

  it("keeps reports about different players", () => {
    const feed = feedFor([
      fantasyProsItem(),
      rotowireItem({ playerName: "Brock Purdy" }),
    ]);

    expect(feed.items.length).toBe(2);
  });

  it("never collapses items nobody attributed to a player", () => {
    const feed = feedFor([
      without(fantasyProsItem(), "playerName", "providerPlayerId"),
      without(rotowireItem(), "playerName"),
    ]);

    expect(feed.items.length).toBe(2);
  });

  it("keeps a pair whose timestamps cannot be read", () => {
    const feed = feedFor([
      without(fantasyProsItem({ fetchedAt: "not a date" }), "publishedAt"),
      without(rotowireItem({ fetchedAt: "not a date" }), "publishedAt"),
    ]);

    expect(feed.items.length).toBe(2);
  });
});
