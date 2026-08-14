import { describe, expect, it } from "vitest";
import { parsePlayerContextEvidenceCsv } from "../src/data/playerContextEvidenceImports.js";
import { buildPlayerNewsFeed } from "../src/modeling/playerNews.js";

describe("player news characterization", () => {
  it("keeps stable chronology and available-target precedence", () => {
    const evidenceRows = parsePlayerContextEvidenceCsv([
      "player,category,score,confidence,source,note,provider,source_date,source_quality",
      "Shared Player,opportunity,1,1,local,Fact: role expanded; inference: raise the bid.,Camp Wire,2026-08-03T14:00:00Z,primary",
    ].join("\n"));
    const feed = buildPlayerNewsFeed({
      evidenceRows,
      rawNewsItems: [{
        provider: "rotowire-rss",
        providerItemId: "shared-player-news",
        playerName: "Shared Player",
        title: "Returns to first-team work",
        summary: "Shared Player worked with the starters.",
        publishedAt: "2026-08-03T14:00:00.000Z",
        fetchedAt: "2026-08-03T15:00:00.000Z",
        tags: ["Unknown", "Depth chart"],
        raw: {},
      }],
      playerMetadata: [{
        name: "Shared Player",
        position: "WR",
        teamAbbreviation: "BUF",
      }],
      draftState: {
        availableTargets: [{
          name: "Shared Player",
          position: "WR",
          teamAbbreviation: "BUF",
          expectedPrice: 17,
          liveExpectedPrice: 19,
          personalValue: 22,
          recommendedMaxBid: 21,
          valueScore: 15.79,
        }],
        events: [{ player: "Shared Player", owner: "Other Team", price: 20 }],
        owners: [{
          owner: "Other Team",
          roster: [{
            name: "Shared Player",
            position: "WR",
            teamAbbreviation: "BUF",
            price: 20,
            source: "keeper",
          }],
        }],
      },
      generatedAt: "2026-08-03T16:00:00.000Z",
    });

    expect(feed.items.map(item => item.providerItemId)).toEqual([
      "local-evidence-1",
      "shared-player-news",
    ]);
    expect(feed.items[1]).toMatchObject({
      category: "Depth chart",
      position: "WR",
      teamAbbreviation: "BUF",
      sourceDate: "2026-08-03T14:00:00.000Z",
      auction: {
        status: "available",
        liveExpectedPrice: 19,
        recommendedMaxBid: 21,
      },
      availability: {
        status: "available",
        detail: "$19 live / $21 max",
      },
    });
  });

  it("reports totals before filters while preserving source ordering", () => {
    const feed = buildPlayerNewsFeed({
      rawNewsItems: [{
        provider: "rotowire-rss",
        providerItemId: "newer",
        playerName: "Newer Player",
        title: "Limited at practice",
        summary: "Newer Player was limited with an ankle issue.",
        publishedAt: "2026-08-04T14:00:00.000Z",
        fetchedAt: "2026-08-04T15:00:00.000Z",
        tags: ["Practice", "Injury"],
        raw: {},
      }, {
        provider: "rotowire-rss",
        providerItemId: "older",
        playerName: "Older Player",
        title: "Signs with new team",
        summary: "Older Player signed a contract.",
        publishedAt: "2026-08-03T14:00:00.000Z",
        fetchedAt: "2026-08-04T15:00:00.000Z",
        tags: ["Transaction"],
        raw: {},
      }],
      draftState: { availableTargets: [], events: [], owners: [] },
      filters: { query: "newer", draftAction: "Watch" },
    });

    expect(feed.items.map(item => item.player)).toEqual(["Newer Player"]);
    expect(feed.summary).toEqual({
      totalCount: 2,
      filteredCount: 1,
      moveUpCount: 0,
      watchCount: 2,
      fadeCount: 0,
      noChangeCount: 0,
    });
  });
});
