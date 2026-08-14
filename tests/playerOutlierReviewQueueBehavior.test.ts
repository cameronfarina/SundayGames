import { describe, expect, it } from "vitest";
import {
  buildPlayerOutlierReviewQueue,
  playerOutlierReviewQueueCsv,
} from "../src/modeling/playerOutlierReviewQueue.js";
import type {
  TopPlayerSanityReport,
  TopPlayerSanityRow,
} from "../src/modeling/topPlayerSanity.js";

const player = (
  values: Partial<TopPlayerSanityRow>,
): TopPlayerSanityRow => ({
  rank: 1,
  name: "Steady Player",
  position: "WR",
  publicAnchorValue: 20,
  projectionRank: 1,
  espnRank: 1,
  rankGap: 0,
  basePrice: 20,
  scenarioPrice: 20,
  draftedCount: 4,
  draftedRate: 1,
  averageMockSalePrice: 20,
  saleVsScenarioPrice: 0,
  minMockSalePrice: 20,
  maxMockSalePrice: 20,
  contextAdjustmentPercent: 0,
  contextEvidenceCount: 1,
  flags: [],
  ...values,
});

const report = (
  players: readonly TopPlayerSanityRow[],
  runs = 4,
): TopPlayerSanityReport => ({
  config: {
    scenarioKey: "expected",
    limit: 40,
    runs,
    seedPrefix: "behavior-test",
  },
  scenario: {
    label: "Expected",
    openAuctionDollars: 2_700,
    globalFactor: 1,
  },
  summary: {
    reviewedCount: players.length,
    flaggedPlayerCount: players.filter(value => value.flags.length > 0).length,
    flagCounts: {},
    highPriceVolume: [],
  },
  players: [...players],
  flaggedPlayers: players.filter(value => value.flags.length > 0),
});

describe("player outlier review queue behavior", () => {
  it("omits steady players and keeps informational flags at low priority", () => {
    const queue = buildPlayerOutlierReviewQueue(report([
      player({}),
      player({
        rank: 2,
        name: "Context Only",
        contextAdjustmentPercent: -0.04,
        flags: [{
          key: "contextPenalty",
          severity: "info",
          message: "Context trims price.",
        }],
      }),
    ]));

    expect(queue.summary).toEqual({
      playerCount: 1,
      highPriorityCount: 0,
      mediumPriorityCount: 0,
      lowPriorityCount: 1,
      reasonCounts: { contextPenalty: 1 },
    });
    expect(queue.rows[0]).toMatchObject({
      player: "Context Only",
      priority: "low",
      primaryReason: "contextPenalty",
    });
  });

  it("does not flag thin demand until enough mock runs exist", () => {
    const limitedDemand = player({
      name: "Limited Demand",
      publicAnchorValue: 25,
      basePrice: 25,
      scenarioPrice: 25,
      draftedCount: 2,
      draftedRate: 0.5,
      averageMockSalePrice: 25,
      minMockSalePrice: 25,
      maxMockSalePrice: 25,
    });

    expect(buildPlayerOutlierReviewQueue(report([limitedDemand], 4)).rows).toEqual([]);
    expect(
      buildPlayerOutlierReviewQueue(report([limitedDemand], 5))
        .rows[0]?.outlierReasons.map(reason => reason.key),
    ).toEqual(["thinMockDemand"]);
  });

  it("escapes quoted player names and CSV fields without changing audit commands", () => {
    const queue = buildPlayerOutlierReviewQueue(report([player({
      name: "A \"Quoted\", Player",
      scenarioPrice: 30,
      averageMockSalePrice: 37,
      saleVsScenarioPrice: 7,
      minMockSalePrice: 37,
      maxMockSalePrice: 37,
      flags: [{
        key: "highMockPremium",
        severity: "review",
        message: "Premium, with punctuation.",
      }],
    })]));

    expect(queue.rows[0]?.auditCommand).toBe(
      "npm run audit -- --player=\"A \\\"Quoted\\\", Player\" --scenario=expected",
    );
    const csv = playerOutlierReviewQueueCsv(queue);
    expect(csv).toContain("\"A \"\"Quoted\"\", Player\"");
    expect(csv.split("\n")).toHaveLength(2);
  });

  it("maps every inherited sanity flag to review details and priority", () => {
    const queue = buildPlayerOutlierReviewQueue(report([
      player({
        rank: 3,
        name: "Missing Evidence",
        scenarioPrice: 49,
        contextEvidenceCount: 0,
        flags: [{
          key: "missingFactualEvidence",
          severity: "review",
          message: "Evidence is missing.",
        }],
      }),
      player({
        rank: 4,
        name: "Ceiling Player",
        basePrice: 35,
        scenarioPrice: 35,
        flags: [{
          key: "hardCeilingPressure",
          severity: "info",
          message: "Price reached its ceiling.",
        }],
      }),
      player({
        rank: 5,
        name: "Unranked Lift",
        rankGap: null,
        scenarioPrice: 40,
        flags: [{
          key: "largeProjectionRankLift",
          severity: "review",
          message: "Projection rank is elevated.",
        }],
      }),
    ]));

    const missing = queue.rows.find(row => row.player === "Missing Evidence");
    expect(missing).toMatchObject({ priority: "medium" });
    expect(missing?.outlierReasons[0]).toMatchObject({
      threshold: "scenario price >= $50 and evidence count = 0",
      actual: "0 evidence row(s)",
    });

    const ceiling = queue.rows.find(row => row.player === "Ceiling Player");
    expect(ceiling).toMatchObject({ priority: "high" });
    expect(ceiling?.outlierReasons[0]).toMatchObject({
      threshold: "base price at hard ceiling",
      actual: "$35",
    });

    const lift = queue.rows.find(row => row.player === "Unranked Lift");
    expect(lift).toMatchObject({ priority: "medium", rankGap: null });
    expect(lift?.outlierReasons[0]).toMatchObject({
      threshold: "rank gap <= -5 for expensive players or <= -30 overall",
      actual: "n/a",
    });
    expect(playerOutlierReviewQueueCsv(queue)).toContain(
      "medium,5,Unranked Lift,WR,20,20,40,20,0,20,20,0,1,,0,1",
    );
  });
});
