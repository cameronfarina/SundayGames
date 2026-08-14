import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import { buildAuctionConfig, simulateAuction } from "../../src/modeling/auctionEngine.js";
import { defined, player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("records the rotating nominator while elite market names come off early", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 1,
      rosterMaximums: positionAmounts(1),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "nomination-order-a",
    });

    const result = simulateAuction({
      players: [
        player("Later value WR", "WR", 35),
        player("Elite market RB", "RB", 70),
      ],
      config,
    });

    expect(result.picks[0]).toMatchObject({
      nominator: "Owner01",
      player: "Elite market RB",
    });
    expect(result.picks[0]?.nominationDiagnostics).toMatchObject({
      selectedPlayer: "Elite market RB",
      candidateCount: 2,
    });
    const openingNomination = result.picks[0]?.nominationDiagnostics;
    expect(openingNomination?.selectedScore).toBe(openingNomination?.topCandidates[0]?.score);
    expect(openingNomination?.topCandidates.length ?? 0).toBeLessThanOrEqual(3);
    expect(openingNomination?.topCandidates.every((candidate, index, candidates) =>
      index === 0 || candidate.score <= defined(candidates[index - 1], "Expected previous nomination candidate.").score,
    )).toBe(true);
    expect(result.picks[0]?.nominationDiagnostics.topCandidates[0]).toEqual(
      expect.objectContaining({
        rank: 1,
        player: "Elite market RB",
        position: "RB",
        marketPrice: 70,
        score: expect.any(Number),
        scoreComponents: expect.objectContaining({
          marketPrice: 1,
          ownerNeed: 0.2,
        }),
        weightedComponents: expect.objectContaining({
          marketPrice: expect.any(Number),
        }),
      }),
    );
  });

  it("varies the opening nominator by seed while keeping each run deterministic", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const players = [
      player("Later value WR", "WR", 35),
      player("Elite market RB", "RB", 70),
    ];
    const firstNominatorFor = (seed: string): Owner | undefined =>
      simulateAuction({
        players,
        config: buildAuctionConfig({
          owners,
          auctionBudget: 100,
          rosterSize: 1,
          rosterMaximums: positionAmounts(1),
          starterMinimums: positionAmounts(0),
          flexMinimum: 0,
          ownerDemandMultipliers: {},
          seed,
        }),
      }).picks[0]?.nominator;

    expect(firstNominatorFor("start-0")).toBe(firstNominatorFor("start-0"));
    expect(new Set([firstNominatorFor("start-0"), firstNominatorFor("start-1")]).size).toBe(2);
  });

  it("lets the current nominator target an affordable roster need instead of the next luxury player", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03"];
    const starterMinimums = {
      ...positionAmounts(0),
      RB: 1,
    };
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums,
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "nomination-needs-1",
    });

    const result = simulateAuction({
      players: [
        player("Elite opening WR", "WR", 70),
        player("Luxury QB", "QB", 60),
        player("Owner02 reachable RB", "RB", 18),
        player("Fallback RB 1", "RB", 17),
        player("Fallback RB 2", "RB", 16),
      ],
      initialRostersByOwner: {
        Owner02: [player("Owner02 kept QB", "QB", 80)],
      },
      config,
    });

    expect(result.picks[1]).toMatchObject({
      nominator: "Owner02",
      player: "Owner02 reachable RB",
    });
    expect(result.picks[1]?.nominationDiagnostics.topCandidates[0]).toMatchObject({
      player: "Owner02 reachable RB",
      scoreComponents: expect.objectContaining({
        ownerNeed: 1,
        affordability: 1,
      }),
    });
    expect(result.picks[1]?.player).toBe("Owner02 reachable RB");
  });
});
