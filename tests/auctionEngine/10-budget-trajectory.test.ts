import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import { buildAuctionConfig, simulateAuction } from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("records owner budget trajectory from initial budgets through every sold pick", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 20,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "budget-trajectory",
    });
    const result = simulateAuction({
      players: [
        player("Trajectory RB 1", "RB", 10),
        player("Trajectory WR 1", "WR", 8),
        player("Trajectory RB 2", "RB", 2),
        player("Trajectory WR 2", "WR", 1),
      ],
      config,
    });

    expect(result.budgetTrajectory).toHaveLength((result.picks.length + 1) * owners.length);

    const initialRows = result.budgetTrajectory.filter(row => row.event === "initial");
    expect(initialRows).toHaveLength(owners.length);
    expect(initialRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pick: 0,
        owner: "Owner01",
        spent: 0,
        initialSpend: 0,
        auctionSpend: 0,
        budgetRemaining: 20,
        rosterSlotsRemaining: 2,
        maxBid: 19,
        rosterSize: 0,
        budgetPerRosterSlot: 10,
      }),
    ]));

    const firstPick = result.picks[0];
    if (!firstPick) throw new Error("Expected at least one pick.");
    const winnerAfterFirstPick = result.budgetTrajectory.find(row =>
      row.event === "after_pick" &&
      row.pick === firstPick.pick &&
      row.owner === firstPick.owner,
    );

    expect(winnerAfterFirstPick).toMatchObject({
      nominator: firstPick.nominator,
      winningOwner: firstPick.owner,
      player: firstPick.player,
      position: firstPick.position,
      marketPrice: firstPick.marketPrice,
      salePrice: firstPick.price,
      initialSpend: 0,
      auctionSpend: firstPick.price,
      budgetRemaining: firstPick.budgetAfterPick,
      rosterSlotsRemaining: firstPick.rosterSlotsAfterPick,
      rosterSize: 1,
    });
    expect(winnerAfterFirstPick?.positionCounts[firstPick.position]).toBe(1);

    const finalRows = result.budgetTrajectory.filter(row => row.pick === result.picks.length);
    expect(finalRows).toHaveLength(owners.length);
    expect(finalRows.every(row => row.event === "after_pick")).toBe(true);
    expect(finalRows.every(row => row.rosterSlotsRemaining === 0 && row.maxBid === 0)).toBe(true);
    for (const ownerState of result.ownerStates) {
      const finalRow = finalRows.find(row => row.owner === ownerState.owner);
      expect(finalRow).toMatchObject({
        spent: ownerState.spent,
        budgetRemaining: ownerState.budgetRemaining,
        rosterSlotsRemaining: ownerState.rosterSlotsRemaining,
        maxBid: ownerState.maxBid,
        rosterSize: ownerState.roster.length,
        budgetPerRosterSlot: null,
      });
    }
  });
});
