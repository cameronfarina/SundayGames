import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseFantasyProsNews,
  type FantasyProsClient,
  type FantasyProsNewsItem,
} from "../src/data/fantasyPros.js";
import { InMemoryFantasyProsRepository } from "../src/platform/fantasyPros.js";
import {
  fantasyProsDailyRequestBudget,
  fantasyProsRefreshPollIntervalMs,
  refreshFantasyProsDatasets,
} from "../src/platform/fantasyProsRefresh.js";
import { InMemoryPlayerNewsRepository } from "../src/platform/playerNews.js";
import {
  playerNewsCadenceMs,
  playerNewsDailyRequestBudget,
  playerNewsDatasetRefreshes,
  playerNewsRetentionCadenceMs,
} from "../src/platform/playerNewsRefresh.js";
import { stubReportingFeed } from "./support/reportingFeed.js";

const newsFixture: unknown = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/fantasyPros/news.json"), "utf8"),
);

const newsClient = (
  items: readonly FantasyProsNewsItem[] = parseFantasyProsNews(newsFixture),
): FantasyProsClient => ({
  fetchRankings: async () => { throw new Error("Not part of the news refresh."); },
  fetchProjections: async () => { throw new Error("Not part of the news refresh."); },
  fetchPlayers: async () => [],
  fetchNews: async () => items,
});

// Inside the seven-day retention window of the recorded fixture, or the pass
// would store items the feed immediately filters back out.
const now = new Date("2026-08-18T22:00:00.000Z");

const harness = (client?: FantasyProsClient) => {
  const fantasyProsRepository = new InMemoryFantasyProsRepository();
  const newsRepository = new InMemoryPlayerNewsRepository();
  const entries = playerNewsDatasetRefreshes({
    newsRepository,
    fantasyProsRepository,
    ...(client === undefined ? {} : { fantasyProsClient: client }),
  });
  return { entries, fantasyProsRepository, newsRepository };
};

describe("player news refresh", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("stores both providers on one pass", async () => {
    stubReportingFeed();
    const { entries, fantasyProsRepository, newsRepository } = harness(newsClient());

    const results = await refreshFantasyProsDatasets(
      { repository: fantasyProsRepository, now: () => now },
      entries,
    );

    expect(results.map(result => result.status)).toEqual(["refreshed", "refreshed", "refreshed"]);
    const providers = new Set((await newsRepository.recentItems(now))
      .map(item => item.provider));
    expect(providers).toEqual(new Set(["fantasypros", "rotowire-rss"]));
  });

  it("names the FantasyPros player from the catalog the foundation already syncs", async () => {
    stubReportingFeed();
    const { entries, fantasyProsRepository, newsRepository } = harness(newsClient());
    await fantasyProsRepository.savePlayers({
      players: [{
        playerId: 16393,
        playerName: "Christian McCaffrey",
        position: "RB",
        positions: ["RB"],
        teamAbbreviation: "SF",
      }],
      fetchedAt: now.toISOString(),
    });

    await refreshFantasyProsDatasets(
      { repository: fantasyProsRepository, now: () => now },
      entries,
    );

    const stored = (await newsRepository.recentItems(now))
      .find(item => item.providerPlayerId === "16393");
    expect(stored).toMatchObject({
      playerName: "Christian McCaffrey",
      provider: "fantasypros",
      providerTeamAbbreviation: "SF",
    });
    expect(stored?.categories).toContain("Injury");
  });

  it("asks the catalog only about the players the pull actually mentions", async () => {
    // Loading all 8,500 rows every fifteen minutes is the kind of read this
    // slice exists to remove, not to move somewhere else.
    stubReportingFeed();
    const { entries, fantasyProsRepository } = harness(newsClient());
    const playersByIds = vi.spyOn(fantasyProsRepository, "playersByIds");
    const players = vi.spyOn(fantasyProsRepository, "players");

    await refreshFantasyProsDatasets(
      { repository: fantasyProsRepository, now: () => now },
      entries,
    );

    expect(players).not.toHaveBeenCalled();
    expect(playersByIds.mock.calls[0]?.[0].length).toBeLessThanOrEqual(23);
  });

  it("keeps RotoWire on schedule when FantasyPros news fails", async () => {
    // Two datasets, not one, so one desk going down cannot cost a whole
    // cadence of the other's reporting.
    stubReportingFeed();
    const failing: FantasyProsClient = {
      ...newsClient(),
      fetchNews: async () => { throw new Error("FantasyPros request to /nfl/news failed with 500."); },
    };
    const { entries, fantasyProsRepository, newsRepository } = harness(failing);

    const results = await refreshFantasyProsDatasets(
      { repository: fantasyProsRepository, now: () => now, onError: vi.fn() },
      entries,
    );

    expect(results.find(result => result.dataset === "news-fantasypros")?.status).toBe("failed");
    expect(results.find(result => result.dataset === "news-rotowire")?.status).toBe("refreshed");
    expect(await newsRepository.recentItems(now)).not.toEqual([]);
  });

  it("schedules no FantasyPros news request without an API key", async () => {
    stubReportingFeed();
    const { entries, fantasyProsRepository, newsRepository } = harness();

    const results = await refreshFantasyProsDatasets(
      { repository: fantasyProsRepository, now: () => now },
      entries,
    );

    expect(results.map(result => result.dataset))
      .toEqual(["news-rotowire", "news-retention"]);
    expect(await newsRepository.recentItems(now)).not.toEqual([]);
  });

  it("skips a second pass inside the cadence window", async () => {
    stubReportingFeed();
    const client = newsClient();
    const fetchNews = vi.spyOn(client, "fetchNews");
    const { entries, fantasyProsRepository } = harness(client);

    await refreshFantasyProsDatasets({ repository: fantasyProsRepository, now: () => now }, entries);
    const results = await refreshFantasyProsDatasets(
      { repository: fantasyProsRepository, now: () => new Date(now.getTime() + 60_000) },
      entries,
    );

    expect(results.every(result => result.status === "skipped")).toBe(true);
    expect(fetchNews).toHaveBeenCalledOnce();
  });

  it("drops rows past the retention window on its own slower cadence", async () => {
    stubReportingFeed();
    const { entries, fantasyProsRepository, newsRepository } = harness();
    await newsRepository.saveItems([{
      provider: "rotowire-rss",
      providerItemId: "ancient",
      title: "Old news",
      summary: "s",
      publishedAt: "2026-01-01T00:00:00.000Z",
      fetchedAt: "2026-01-01T00:00:00.000Z",
      tags: ["News"],
    }]);

    await refreshFantasyProsDatasets({ repository: fantasyProsRepository, now: () => now }, entries);

    const remaining = await newsRepository.recentItems(new Date("2026-01-02T00:00:00.000Z"));
    expect(remaining.map(item => item.providerItemId)).not.toContain("ancient");
    expect(playerNewsRetentionCadenceMs).toBeGreaterThan(playerNewsCadenceMs);
  });

  it("polls more often than the shortest cadence so the cadence is what governs", () => {
    // With a poll interval equal to the cadence, jitter makes a dataset miss
    // its window and land at twice the intended interval.
    expect(fantasyProsRefreshPollIntervalMs).toBeLessThan(playerNewsCadenceMs);
  });

  it("keeps the combined daily request budget well under the account quota", () => {
    const { entries } = harness(newsClient());
    const perDay = entries.reduce(
      (total, entry) => total + entry.requestCount * Math.round(24 * 60 * 60 * 1000 / entry.cadenceMs),
      0,
    );

    // One FantasyPros request every fifteen minutes. RotoWire and the
    // retention sweep spend none.
    expect(perDay).toBe(playerNewsDailyRequestBudget);
    expect(perDay).toBe(96);
    expect(fantasyProsDailyRequestBudget + playerNewsDailyRequestBudget).toBeLessThan(200);
  });
});
