import { describe, expect, it } from "vitest";
import {
  importEspnLeagueSettings,
  type EspnLeagueSettingsHttpTransport,
} from "../src/platform/espnLeagueSettingsImport.js";

const scoringItems = (
  reception = 0.5,
  passingTouchdown = 4,
): readonly { statId: number; points: number }[] => [
  { statId: 3, points: 0.04 },
  { statId: 4, points: passingTouchdown },
  { statId: 24, points: 0.1 },
  { statId: 25, points: 6 },
  { statId: 42, points: 0.1 },
  { statId: 43, points: 6 },
  { statId: 53, points: reception },
];

describe("importEspnLeagueSettings", () => {
  it("imports an anonymous ESPN auction league into a confirmation review", async () => {
    const requestedUrls: string[] = [];
    const transport: EspnLeagueSettingsHttpTransport = async request => {
      requestedUrls.push(request.url);

      return {
        code: 200,
        body: {
          id: 214674,
          seasonId: 2026,
          settings: {
            name: "The League",
            size: 2,
            draftSettings: {
              type: "AUCTION",
              auctionBudget: 200,
              pickOrder: [7, 3],
            },
            scoringSettings: {
              scoringItems: scoringItems(1, 4),
            },
            rosterSettings: {
              lineupSlotCounts: {
                0: 1,
                2: 2,
                4: 2,
                6: 1,
                16: 1,
                17: 1,
                20: 7,
                21: 2,
              },
            },
          },
          teams: [
            {
              id: 3,
              abbrev: "CAM",
              location: "Cam's",
              nickname: "Team",
              email: "private@example.com",
              status: "active",
            },
            { id: 7, abbrev: "BTD", name: "Beaton FC" },
          ],
          cookies: "private-cookie",
          tokens: ["private-token"],
        },
      };
    };

    const result = await importEspnLeagueSettings(
      { leagueIdOrUrl: 214674, season: 2026 },
      transport,
    );

    expect(requestedUrls).toHaveLength(1);
    const requestedUrl = new URL(requestedUrls[0] ?? "");
    expect(requestedUrl.origin).toBe("https://lm-api-reads.fantasy.espn.com");
    expect(requestedUrl.pathname).toBe("/apis/v3/games/ffl/seasons/2026/segments/0/leagues/214674");
    expect(requestedUrl.searchParams.getAll("view")).toEqual(["mSettings", "mTeam"]);
    expect(result).toEqual({
      kind: "review",
      provider: "espn",
      confirmationRequired: true,
      review: {
        externalLeagueId: "214674",
        season: 2026,
        leagueName: "The League",
        teamCount: 2,
        draft: {
          type: "auction",
          budgetDollars: 200,
          minimumBidDollars: 1,
        },
        scoring: {
          pointsPerPassingYard: 0.04,
          pointsPerPassingTouchdown: 4,
          pointsPerRushingYard: 0.1,
          pointsPerRushingTouchdown: 6,
          pointsPerReceivingYard: 0.1,
          pointsPerReceivingTouchdown: 6,
          pointsPerReception: 1,
        },
        rosterSlots: {
          QB: 1,
          RB: 2,
          WR: 2,
          TE: 1,
          DST: 1,
          K: 1,
          BENCH: 7,
          IR: 2,
        },
        teams: [
          {
            externalTeamId: "7",
            displayName: "Beaton FC",
            abbreviation: "BTD",
            draftOrderPosition: 1,
          },
          {
            externalTeamId: "3",
            displayName: "Cam's Team",
            abbreviation: "CAM",
            draftOrderPosition: 2,
          },
        ],
      },
      warnings: [
        {
          code: "minimum_bid_defaulted",
          message: "ESPN did not provide a minimum bid, so the review uses ESPN's $1 minimum.",
        },
      ],
    });
    const serializedResult = JSON.stringify(result);
    expect(serializedResult).not.toContain("private@example.com");
    expect(serializedResult).not.toContain("active");
    expect(serializedResult).not.toContain("private-cookie");
    expect(serializedResult).not.toContain("private-token");
  });

  it("routes a private ESPN league URL to screenshot or manual review without auth input", async () => {
    const requests: unknown[] = [];
    const transport: EspnLeagueSettingsHttpTransport = async request => {
      requests.push(request);
      return {
        code: 403,
        body: {
          message: "You are not authorized.",
          token: "provider-secret-that-must-not-escape",
        },
      };
    };

    const result = await importEspnLeagueSettings(
      {
        leagueIdOrUrl: "https://fantasy.espn.com/football/league/settings?leagueId=214674",
        season: 2026,
      },
      transport,
    );

    expect(requests).toEqual([
      {
        method: "GET",
        url: expect.stringContaining("/leagues/214674"),
      },
    ]);
    expect(result).toEqual({
      kind: "manual-review-required",
      provider: "espn",
      confirmationRequired: true,
      reason: "private_or_unauthorized",
      externalLeagueId: "214674",
      season: 2026,
      confirmationMethods: ["screenshot", "manual"],
      message: "This ESPN league is private. Confirm its settings from screenshots or enter them manually.",
    });
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("normalizes snake rounds and draft order", async () => {
    const transport: EspnLeagueSettingsHttpTransport = async () => ({
      code: 200,
      body: {
        settings: {
          name: "Snake League",
          size: 2,
          draftSettings: {
            type: "SNAKE",
            pickOrder: [11, 4],
          },
          scoringSettings: {
            scoringItems: scoringItems(0.5, 6),
          },
          rosterSettings: {
            lineupSlotCounts: { 0: 1, 2: 1, 20: 1 },
          },
        },
        teams: [
          { id: 4, abbrev: "FOUR", name: "Fourth Team" },
          { id: 11, abbrev: "ELVN", name: "Eleventh Team" },
        ],
      },
    });

    const result = await importEspnLeagueSettings(
      { leagueIdOrUrl: "9001", season: 2027 },
      transport,
    );

    expect(result.kind).toBe("review");
    if (result.kind !== "review") throw new Error("Expected an ESPN settings review.");
    expect(result.review.draft).toEqual({
      type: "snake",
      rounds: 3,
      order: ["11", "4"],
    });
    expect(result.review.scoring).toEqual({
      pointsPerPassingYard: 0.04,
      pointsPerPassingTouchdown: 6,
      pointsPerRushingYard: 0.1,
      pointsPerRushingTouchdown: 6,
      pointsPerReceivingYard: 0.1,
      pointsPerReceivingTouchdown: 6,
      pointsPerReception: 0.5,
    });
    expect(result.review.teams.map(team => [team.externalTeamId, team.draftOrderPosition])).toEqual([
      ["11", 1],
      ["4", 2],
    ]);
    expect(result.warnings).toEqual([
      {
        code: "rounds_derived_from_roster",
        message: "ESPN did not provide snake rounds, so the review uses the 3 imported roster slots.",
      },
    ]);
  });

  it("normalizes ESPN hybrid slots and excludes IR from inferred snake rounds", async () => {
    const transport: EspnLeagueSettingsHttpTransport = async () => ({
      code: 200,
      body: {
        settings: {
          size: 1,
          draftSettings: { type: "SNAKE", pickOrder: [1] },
          scoringSettings: {
            scoringItems: scoringItems(1, 4),
          },
          rosterSettings: {
            lineupSlotCounts: { 3: 1, 5: 1, 7: 1, 21: 2, 23: 1 },
          },
        },
        teams: [{ id: 1, name: "Only Team" }],
      },
    });

    const result = await importEspnLeagueSettings(
      { leagueIdOrUrl: 1, season: 2026 },
      transport,
    );

    expect(result.kind).toBe("review");
    if (result.kind !== "review") throw new Error("Expected an ESPN settings review.");
    expect(result.review.rosterSlots).toEqual({
      RB_WR: 1,
      WR_TE: 1,
      OP: 1,
      IR: 2,
      FLEX: 1,
    });
    expect(result.review.draft).toEqual({
      type: "snake",
      rounds: 4,
      order: ["1"],
    });
  });

  it("routes an unknown positive roster slot to explicit manual review", async () => {
    const transport: EspnLeagueSettingsHttpTransport = async () => ({
      code: 200,
      body: {
        settings: {
          size: 1,
          draftSettings: { type: "SNAKE", rounds: 1, pickOrder: [1] },
          scoringSettings: {
            scoringItems: scoringItems(1, 4),
          },
          rosterSettings: {
            lineupSlotCounts: { 0: 1, 99: 1 },
          },
        },
        teams: [{ id: 1, name: "Only Team" }],
      },
    });

    await expect(importEspnLeagueSettings(
      { leagueIdOrUrl: 1, season: 2026 },
      transport,
    )).resolves.toEqual({
      kind: "manual-review-required",
      provider: "espn",
      confirmationRequired: true,
      reason: "settings_need_review",
      externalLeagueId: "1",
      season: 2026,
      confirmationMethods: ["screenshot", "manual"],
      message: "ESPN roster slot 99 is not supported. Review the league roster settings manually before continuing.",
    });
  });

  it("requires manual review when ESPN omits a modeled scoring rule", async () => {
    const transport: EspnLeagueSettingsHttpTransport = async () => ({
      code: 200,
      body: {
        settings: {
          size: 1,
          draftSettings: { type: "SNAKE", rounds: 1, pickOrder: [1] },
          scoringSettings: {
            scoringItems: scoringItems().filter(item => item.statId !== 42),
          },
          rosterSettings: { lineupSlotCounts: { 0: 1 } },
        },
        teams: [{ id: 1, name: "Only Team" }],
      },
    });

    await expect(importEspnLeagueSettings(
      { leagueIdOrUrl: 1, season: 2026 },
      transport,
    )).resolves.toEqual({
      kind: "manual-review-required",
      provider: "espn",
      confirmationRequired: true,
      reason: "settings_need_review",
      externalLeagueId: "1",
      season: 2026,
      confirmationMethods: ["screenshot", "manual"],
      message: "ESPN response is missing receiving yard points. Review scoring manually before continuing.",
    });
  });
});
