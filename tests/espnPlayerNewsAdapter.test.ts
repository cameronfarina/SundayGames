import { describe, expect, it } from "vitest";
import { parseEspnNews } from "../src/data/espnPlayerNewsAdapter.js";

describe("ESPN player news adapter", () => {
  it("parses an article with an athlete category into a tagged raw item", () => {
    const items = parseEspnNews({
      content: {
        articles: [{
          id: 44556677,
          headline: "Player X (hamstring) questionable for Sunday",
          description: "X was limited in practice Friday with a hamstring issue.",
          published: "2026-08-16T18:30:00Z",
          links: { web: { href: "https://www.espn.com/nfl/story/_/id/44556677" } },
          categories: [{ athlete: { name: "Player X", description: "Player X" } }],
        }],
      },
      fetchedAt: "2026-08-17T00:00:00.000Z",
    });

    expect(items).toEqual([{
      provider: "espn",
      providerItemId: "44556677",
      canonicalUrl: "https://www.espn.com/nfl/story/_/id/44556677",
      playerName: "Player X",
      title: "Player X (hamstring) questionable for Sunday",
      summary: "X was limited in practice Friday with a hamstring issue.",
      publishedAt: "2026-08-16T18:30:00.000Z",
      fetchedAt: "2026-08-17T00:00:00.000Z",
      tags: ["Practice", "Injury"],
      raw: items[0]?.raw,
    }]);
  });

  it("omits the player name when no article carries an athlete category", () => {
    const items = parseEspnNews({
      content: {
        articles: [{
          id: "league-note",
          headline: "League announces schedule change",
          description: "A general news update.",
          categories: [{ description: "NFL" }],
        }],
      },
    });

    expect(items[0]?.playerName).toBeUndefined();
  });

  it("skips articles missing an id or headline instead of throwing", () => {
    const items = parseEspnNews({ content: { articles: [{ description: "No id or headline." }] } });
    expect(items).toEqual([]);
  });

  it("returns an empty list for a response with no articles array", () => {
    expect(parseEspnNews({ content: { error: "rate limited" } })).toEqual([]);
    expect(parseEspnNews({ content: null })).toEqual([]);
  });
});
