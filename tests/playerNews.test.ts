import { describe, expect, it } from "vitest";
import { parsePlayerContextEvidenceCsv } from "../src/data/playerContextEvidenceImports.js";
import { parseRotowireRssNews } from "../src/data/playerNewsProviderAdapters.js";
import { buildPlayerNewsFeed } from "../src/modeling/playerNews.js";

describe("player news feed", () => {
  it("turns sourced evidence rows into Rotoworld-style draft-impact updates", () => {
    const evidenceRows = parsePlayerContextEvidenceCsv([
      "player,category,score,confidence,source,note,provider,source_date,source_quality",
      "Example WR,opportunity,1.5,0.8,https://example.com/targets,Fact: earned first-team slot routes in camp; inference: target floor is stronger than the current auction room price.,Camp Wire,2026-08-01,primary",
      "Example RB,risk,-2,0.9,https://example.com/injury,Fact: missed a second straight practice with a hamstring issue; inference: availability risk should cap aggressive bids.,Beat Report,2026-08-02,primary",
      "Drafted RB,risk,-1,1,https://example.com/depth,Fact: added goal-line competition; inference: touchdown share is thinner.,Depth Notes,2026-07-31,secondary",
    ].join("\n"));

    const feed = buildPlayerNewsFeed({
      evidenceRows,
      draftState: {
        availableTargets: [{
          name: "Example WR",
          normalizedPlayerName: "example wr",
          position: "WR",
          teamAbbreviation: "BUF",
          expectedPrice: 14,
          liveExpectedPrice: 16,
          personalValue: 19,
          recommendedMaxBid: 18,
          valueScore: 31.25,
          tags: ["starter need"],
        }],
        events: [{
          player: "Drafted RB",
          normalizedPlayerName: "drafted rb",
          owner: "Owner11",
          price: 33,
        }],
        owners: [{
          owner: "Owner11",
          roster: [{
            name: "Drafted RB",
            position: "RB",
            price: 33,
            source: "pricedPool",
          }],
        }],
      },
    });

    expect(feed.items).toHaveLength(3);
    expect(feed.items[0]).toMatchObject({
      player: "Example RB",
      category: "Injury",
      draftAction: "Watch",
      source: {
        provider: "Beat Report",
        url: "https://example.com/injury",
        quality: "primary",
      },
      headline: "Example RB missed a second straight practice with a hamstring issue.",
      fantasyImpact: "availability risk should cap aggressive bids.",
      sourceDate: "2026-08-02",
      availability: {
        status: "unavailable",
      },
    });
    expect(feed.items[1]).toMatchObject({
      player: "Example WR",
      category: "Role",
      draftAction: "Move up",
      auction: {
        status: "available",
        expectedPrice: 14,
        liveExpectedPrice: 16,
        personalValue: 19,
        recommendedMaxBid: 18,
        valueScore: 31.25,
      },
      availability: {
        status: "available",
        detail: "$16 live / $18 max",
      },
    });
    expect(feed.items[2]).toMatchObject({
      player: "Drafted RB",
      availability: {
        status: "drafted",
        detail: "Owner11 bought for $33",
      },
    });
    expect(feed.summary).toMatchObject({
      totalCount: 3,
      moveUpCount: 1,
      fadeCount: 0,
      watchCount: 2,
    });
    expect(feed.providers.map(provider => provider.key)).toEqual([
      "local-evidence",
      "rotowire-rss",
      "fantasypros",
      "sleeper",
      "sportsdataio",
      "rotoballer",
      "rotowire",
    ]);
  });

  it("reserves fade for confirmed missed time or major availability hits", () => {
    const evidenceRows = parsePlayerContextEvidenceCsv([
      "player,category,score,confidence,source,note,provider,source_date,source_quality",
      "Practice RB,risk,-2,0.9,practice,Fact: missed a second straight practice with a hamstring issue; inference: availability risk should cap aggressive bids.,Beat Report,2026-08-02,primary",
      "Confirmed RB,risk,-2,0.9,injury,Fact: will miss at least four weeks after knee surgery; inference: remove from normal bid plans until return timeline changes.,Team Report,2026-08-02,primary",
      "Historical WR,risk,-2,0.9,discipline,Fact: NFL suspended Historical WR one game in 2025; 2026 camp scuffle reported separately; inference: disciplinary history should be monitored.,League Report,2026-08-02,primary",
    ].join("\n"));

    const feed = buildPlayerNewsFeed({
      evidenceRows,
      draftState: {
        availableTargets: [],
        events: [],
        owners: [],
      },
    });

    expect(feed.items.find(item => item.player === "Practice RB")?.draftAction).toBe("Watch");
    expect(feed.items.find(item => item.player === "Confirmed RB")?.draftAction).toBe("Fade");
    expect(feed.items.find(item => item.player === "Historical WR")?.draftAction).toBe("Watch");
  });

  it("keeps practice-only RSS injury blurbs as watch unless missed time is confirmed", () => {
    const feed = buildPlayerNewsFeed({
      rawNewsItems: [{
        provider: "rotowire-rss",
        providerItemId: "practice-1",
        playerName: "Practice WR",
        title: "Misses practice Thursday",
        summary: "Practice WR missed practice Thursday with a minor ankle issue.",
        publishedAt: "2026-08-02T14:00:00.000Z",
        fetchedAt: "2026-08-02T15:00:00.000Z",
        tags: ["Practice", "Injury"],
        raw: {},
      }, {
        provider: "rotowire-rss",
        providerItemId: "confirmed-1",
        playerName: "Confirmed WR",
        title: "Ruled out for Sunday",
        summary: "Confirmed WR has been ruled out for Sunday's game because of a knee injury.",
        publishedAt: "2026-08-02T14:00:00.000Z",
        fetchedAt: "2026-08-02T15:00:00.000Z",
        tags: ["Injury"],
        raw: {},
      }],
      draftState: {
        availableTargets: [],
        events: [],
        owners: [],
      },
      filters: {
        source: "rotowire-rss",
      },
    });

    expect(feed.items.find(item => item.player === "Practice WR")?.draftAction).toBe("Watch");
    expect(feed.items.find(item => item.player === "Confirmed WR")?.draftAction).toBe("Fade");
  });

  it("fills team and position from player metadata when news players are outside the auction pool", () => {
    const feed = buildPlayerNewsFeed({
      rawNewsItems: [{
        provider: "rotowire-rss",
        providerItemId: "remote-1",
        playerName: "Brian Thomas",
        title: "Off to good start in camp",
        summary: "Thomas has followed up his impressive spring with a good start to training camp.",
        publishedAt: "2026-08-03T22:13:00.000Z",
        fetchedAt: "2026-08-03T22:30:00.000Z",
        tags: ["Practice"],
        raw: {},
      }, {
        provider: "rotowire-rss",
        providerItemId: "remote-2",
        playerName: "Trey Benson",
        title: "Tending to sore knee",
        summary: "Benson is dealing with discomfort in his left knee.",
        publishedAt: "2026-08-03T22:00:00.000Z",
        fetchedAt: "2026-08-03T22:30:00.000Z",
        tags: ["Injury"],
        raw: {},
      }],
      playerMetadata: [{
        name: "Brian Thomas Jr.",
        position: "WR",
        teamAbbreviation: "JAX",
      }, {
        name: "Trey Benson",
        position: "RB",
        teamAbbreviation: "ARI",
      }],
      draftState: {
        availableTargets: [],
        events: [],
        owners: [],
      },
      filters: {
        source: "rotowire-rss",
      },
    });

    expect(feed.items.find(item => item.player === "Brian Thomas")).toMatchObject({
      position: "WR",
      teamAbbreviation: "JAX",
      availability: {
        status: "unavailable",
      },
    });
    expect(feed.items.find(item => item.player === "Trey Benson")).toMatchObject({
      position: "RB",
      teamAbbreviation: "ARI",
      availability: {
        status: "unavailable",
      },
    });
  });

  it("defaults to all sources when no source filter is provided", () => {
    const evidenceRows = parsePlayerContextEvidenceCsv([
      "player,category,score,confidence,source,note,provider,source_date,source_quality",
      "Example WR,opportunity,1,1,targets,Fact: role expanded; inference: bid more comfortably.,Camp Wire,2026-08-01,primary",
    ].join("\n"));

    const feed = buildPlayerNewsFeed({
      evidenceRows,
      rawNewsItems: [{
        provider: "rotowire-rss",
        providerItemId: "remote-1",
        canonicalUrl: "https://example.com/remote",
        playerName: "Remote RB",
        title: "Limited at practice",
        summary: "Remote RB was limited at practice.",
        publishedAt: "2026-08-02T14:00:00.000Z",
        fetchedAt: "2026-08-02T15:00:00.000Z",
        tags: ["Practice", "Injury"],
        raw: {},
      }],
      draftState: {
        availableTargets: [],
        events: [],
        owners: [],
      },
    });

    expect(feed.sourceMode).toBe("all");
    expect(feed.items.map(item => item.player)).toEqual(["Remote RB", "Example WR"]);
  });

  it("honors explicit local-only source filters", () => {
    const evidenceRows = parsePlayerContextEvidenceCsv([
      "player,category,score,confidence,source,note,provider,source_date,source_quality",
      "Example WR,opportunity,1,1,targets,Fact: role expanded; inference: bid more comfortably.,Camp Wire,2026-08-01,primary",
    ].join("\n"));

    const feed = buildPlayerNewsFeed({
      evidenceRows,
      rawNewsItems: [{
        provider: "rotowire-rss",
        providerItemId: "remote-1",
        playerName: "Remote RB",
        title: "Limited at practice",
        summary: "Remote RB was limited at practice.",
        fetchedAt: "2026-08-02T15:00:00.000Z",
        tags: ["Practice"],
        raw: {},
      }],
      draftState: {
        availableTargets: [],
        events: [],
        owners: [],
      },
      filters: {
        source: "local",
      },
    });

    expect(feed.sourceMode).toBe("local");
    expect(feed.items.map(item => item.player)).toEqual(["Example WR"]);
  });

  it("filters by search, category, and draft action", () => {
    const evidenceRows = parsePlayerContextEvidenceCsv([
      "player,category,score,confidence,source,note",
      "Example WR,opportunity,1,1,targets,Fact: role expanded; inference: bid more comfortably.",
      "Example RB,risk,-1,1,practice,Fact: missed practice; inference: lower ceiling.",
    ].join("\n"));

    const feed = buildPlayerNewsFeed({
      evidenceRows,
      draftState: {
        availableTargets: [],
        events: [],
        owners: [],
      },
      filters: {
        query: "wr",
        category: "Role",
        draftAction: "Move up",
      },
    });

    expect(feed.items.map(item => item.player)).toEqual(["Example WR"]);
    expect(feed.summary.totalCount).toBe(2);
    expect(feed.summary.filteredCount).toBe(1);
  });

  it("leaves local evidence undated when source dates are missing", () => {
    const evidenceRows = parsePlayerContextEvidenceCsv([
      "player,category,score,confidence,source,note",
      "Example RB,opportunity,1,1,targets,Fact: role expanded; inference: bid more comfortably.",
    ].join("\n"));

    const feed = buildPlayerNewsFeed({
      evidenceRows,
      draftState: {
        availableTargets: [],
        events: [],
        owners: [],
      },
      generatedAt: "2026-08-03T16:00:00.000Z",
    });

    expect(feed.items[0]).toMatchObject({
      player: "Example RB",
    });
    expect(feed.items[0]?.sourceDate).toBeUndefined();
    expect(feed.items[0]?.fetchedAt).toBeUndefined();
  });

  it("matches drafted availability when normalized draft-state names keep canonical casing", () => {
    const evidenceRows = parsePlayerContextEvidenceCsv([
      "player,category,score,confidence,source,note",
      "Deebo Samuel,risk,-1,1,practice,Fact: missed practice; inference: lower ceiling.",
    ].join("\n"));

    const feed = buildPlayerNewsFeed({
      evidenceRows,
      draftState: {
        availableTargets: [],
        events: [{
          player: "Deebo Samuel",
          normalizedPlayerName: "Deebo Samuel",
          owner: "Owner14",
          price: 17,
        }],
        owners: [],
      },
    });

    expect(feed.items[0]?.availability).toEqual({
      status: "drafted",
      detail: "Owner14 bought for $17",
    });
  });

  it("normalizes RotoWire RSS player news into provider-neutral raw items", () => {
    const items = parseRotowireRssNews({
      content: [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<rss version=\"2.0\"><channel>",
        "<item>",
        "<guid>nfl632459</guid>",
        "<title>Kyle Monangai: Back at practice Monday</title>",
        "<link>https://www.rotowire.com/football/player/kyle-monangai-18520</link>",
        "<description>Monangai (undisclosed) was in full uniform for Monday&apos;s practice.</description>",
        "<pubDate>Mon, 03 Aug 2026 7:53:00 AM PDT</pubDate>",
        "</item>",
        "</channel></rss>",
      ].join(""),
      fetchedAt: "2026-08-03T15:00:00.000Z",
    });

    expect(items).toEqual([
      {
        provider: "rotowire-rss",
        providerItemId: "nfl632459",
        canonicalUrl: "https://www.rotowire.com/football/player/kyle-monangai-18520",
        playerName: "Kyle Monangai",
        title: "Back at practice Monday",
        summary: "Monangai (undisclosed) was in full uniform for Monday's practice.",
        publishedAt: "2026-08-03T14:53:00.000Z",
        fetchedAt: "2026-08-03T15:00:00.000Z",
        tags: ["Practice", "Injury"],
        raw: expect.any(Object),
      },
    ]);
  });
});
