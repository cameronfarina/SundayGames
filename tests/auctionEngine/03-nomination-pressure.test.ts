import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import { buildAuctionConfig, simulateAuction } from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("lets nominators attack scarce roster holes that opponents still need", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03"];
    const starterMinimums = {
      ...positionAmounts(0),
      RB: 1,
    };
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 2,
      rosterMaximums: positionAmounts(3),
      starterMinimums,
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      nomination: {
        earlyEliteBiasPicks: 0,
        marketPriceWeight: 1,
        projectionWeight: 0,
        ownerNeedWeight: 0,
        affordabilityWeight: 0,
        scarcityWeight: 0,
        flushMoneyWeight: 0,
        tieBreakWeight: 0,
      },
      seed: "opponent-needs-a",
    });

    const result = simulateAuction({
      players: [
        player("Luxury QB", "QB", 24),
        player("Opponent-needed RB", "RB", 20),
        player("Useful WR", "WR", 8),
        player("Useful TE", "TE", 6),
        player("Fallback RB", "RB", 1),
      ],
      initialRostersByOwner: {
        Owner01: [player("Owner01 kept RB", "RB", 10)],
      },
      config,
    });

    expect(result.picks[0]).toMatchObject({
      nominator: "Owner01",
      player: "Opponent-needed RB",
    });
  });

  it("continues the nomination rotation after skipping owners with full rosters", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03", "Owner04"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 1,
      rosterMaximums: positionAmounts(1),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {
        Owner04: {
          RB: 1.4,
        },
      },
      seed: "nomination-full-skip-6",
    });

    const result = simulateAuction({
      players: [
        player("Elite RB", "RB", 50),
        player("Value WR", "WR", 40),
        player("Fallback QB", "QB", 30),
      ],
      initialRostersByOwner: {
        Owner01: [player("Owner01 kept TE", "TE", 1)],
      },
      config,
    });

    expect(result.picks.slice(0, 2).map(pick => pick.nominator)).toEqual(["Owner02", "Owner03"]);
  });
});
