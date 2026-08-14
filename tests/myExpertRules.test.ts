import { describe, expect, it } from "vitest";
import { injuryWatchCardFor } from "../src/modeling/myExpert/injuryWatchCard.js";
import { lineupAdvisorCardFor } from "../src/modeling/myExpert/lineupCard.js";
import type { MyExpertNewsSignal, MyExpertPlayer } from "../src/modeling/myExpert/contracts.js";
import {
  priorityForGain,
  priorityForLineupEdge,
  priorityForNews,
  priorityForWeek,
} from "../src/modeling/myExpert/priorities.js";
import { byScoreDesc, dropScore, signalTotal } from "../src/modeling/myExpert/scoring.js";
import {
  matchupScoresFor,
  matchupSignalsByPlayerFor,
  newsAdjustmentTotal,
  newsByPlayerFor,
  newsSeverityFor,
} from "../src/modeling/myExpert/signalIndexes.js";
import { tradeTargetCardFor } from "../src/modeling/myExpert/tradeTargetCard.js";

describe("my expert scoring rules", () => {
  it("keeps recommendation priority thresholds stable", () => {
    expect([priorityForGain(6), priorityForGain(3), priorityForGain(2)]).toEqual(["high", "medium", "low"]);
    expect([priorityForWeek(4, 5), priorityForWeek(4, 6), priorityForWeek(4, 7)]).toEqual([
      "high",
      "medium",
      "low",
    ]);
    expect([
      priorityForNews({ playerId: "a", headline: "A", impact: "negative" }),
      priorityForNews({ playerId: "b", headline: "B", impact: "watch" }),
      priorityForNews({ playerId: "c", headline: "C", impact: "positive" }),
      priorityForNews({ playerId: "d", headline: "D", impact: "positive", severity: 1 }),
    ]).toEqual(["high", "medium", "medium", "low"]);
    expect([priorityForLineupEdge(4), priorityForLineupEdge(1.5), priorityForLineupEdge(1)]).toEqual([
      "high",
      "medium",
      "low",
    ]);
  });

  it("indexes, orders, and totals weekly signals", () => {
    const matchups = [
      { playerId: "p", week: 3, score: 2, label: "B", opponent: "Z" },
      { playerId: "p", week: 3, score: 2, label: "A", opponent: "Z" },
      { playerId: "p", week: 3, score: 2, label: "A", opponent: "A" },
      { playerId: "p", week: 3, score: 4 },
      { playerId: "p", week: 2, score: 50 },
    ];
    expect(matchupScoresFor(3, matchups).get("p")).toBe(10);
    expect(matchupSignalsByPlayerFor(3, matchups).get("p")).toEqual([
      { playerId: "p", week: 3, score: 4 },
      { playerId: "p", week: 3, score: 2, label: "A", opponent: "A" },
      { playerId: "p", week: 3, score: 2, label: "A", opponent: "Z" },
      { playerId: "p", week: 3, score: 2, label: "B", opponent: "Z" },
    ]);

    const news: MyExpertNewsSignal[] = [
      { playerId: "p", headline: "Z", impact: "watch", severity: 2 },
      { playerId: "p", headline: "A", impact: "negative", severity: 2 },
    ];
    expect(newsByPlayerFor(news).get("p")?.map(item => item.headline)).toEqual(["A", "Z"]);
    expect([
      newsSeverityFor({ playerId: "a", headline: "A", impact: "positive" }),
      newsSeverityFor({ playerId: "b", headline: "B", impact: "watch" }),
      newsSeverityFor({ playerId: "c", headline: "C", impact: "negative" }),
      newsSeverityFor({ playerId: "d", headline: "D", impact: "positive", severity: 7 }),
    ]).toEqual([1, 2, 3, 7]);
    expect(newsAdjustmentTotal([
      { playerId: "a", headline: "A", impact: "positive" },
      { playerId: "b", headline: "B", impact: "watch" },
      { playerId: "c", headline: "C", impact: "negative" },
    ])).toBe(-4);
  });

  it("keeps score adjustments and deterministic ties stable", () => {
    expect(signalTotal({ opportunityScore: 2, matchupScore: 3, usageScore: 4, trendScore: 1, injuryRisk: 2, weatherRisk: 1 }))
      .toBe(7);
    const scores = new Map<string, number>();
    const kicker: MyExpertPlayer = { id: "k", name: "Kicker", position: "K", projectedPoints: 10 };
    const defense: MyExpertPlayer = { id: "d", name: "Defense", position: "DST", projectedPoints: 10 };
    const receiver: MyExpertPlayer = { id: "w", name: "Alpha", position: "WR", projectedPoints: 10 };
    const otherReceiver: MyExpertPlayer = { id: "x", name: "Beta", position: "WR", projectedPoints: 10 };
    expect([dropScore(kicker, scores), dropScore(defense, scores), dropScore(receiver, scores)]).toEqual([6, 8, 10]);
    expect([otherReceiver, receiver].sort(byScoreDesc(scores)).map(player => player.name)).toEqual(["Alpha", "Beta"]);
  });
});

describe("my expert empty recommendation paths", () => {
  it("selects tied injury and trade candidates deterministically", () => {
    const roster: MyExpertPlayer[] = [
      { id: "z", name: "Zulu", position: "RB", projectedPoints: 5 },
      { id: "a", name: "Alpha", position: "RB", projectedPoints: 5 },
    ];
    expect(injuryWatchCardFor(roster, [
      { playerId: "z", headline: "Zulu limited", impact: "watch", severity: 2 },
      { playerId: "a", headline: "Alpha limited", impact: "watch", severity: 2 },
    ])?.playerIds).toEqual(["a"]);
    expect(tradeTargetCardFor(
      { lineup: { RB: 1 }, rosterMaximums: {} },
      roster,
      [
        { id: "trade-z", name: "Trade Zulu", position: "RB", projectedPoints: 10 },
        { id: "trade-a", name: "Trade Alpha", position: "RB", projectedPoints: 10 },
      ],
      new Map<string, number>(),
    )?.playerIds).toEqual(["trade-a"]);
  });

  it("does not create injury advice for positive or unrostered news", () => {
    expect(injuryWatchCardFor(
      [{ id: "p", name: "Player", position: "RB", projectedPoints: 10 }],
      [
        { playerId: "p", headline: "Cleared", impact: "positive" },
        { playerId: "other", headline: "Limited", impact: "watch" },
      ],
    )).toBeUndefined();
  });

  it("requires complete starters, a flex slot, and flex depth", () => {
    const player: MyExpertPlayer = { id: "p", name: "Player", position: "RB", projectedPoints: 10 };
    const emptyScores = new Map<string, number>();
    const emptyMatchups = new Map<string, readonly []>();
    const emptyNews = new Map<string, readonly []>();
    expect(lineupAdvisorCardFor(1, { lineup: { QB: 1, FLEX: 1 }, rosterMaximums: {} }, [player], emptyScores, emptyMatchups, emptyNews))
      .toBeUndefined();
    expect(lineupAdvisorCardFor(1, { lineup: { RB: 1 }, rosterMaximums: {} }, [player], emptyScores, emptyMatchups, emptyNews))
      .toBeUndefined();
    expect(lineupAdvisorCardFor(1, { lineup: { RB: 1, FLEX: 1 }, rosterMaximums: {} }, [player], emptyScores, emptyMatchups, emptyNews))
      .toBeUndefined();
  });
});
