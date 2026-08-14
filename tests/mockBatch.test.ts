import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { ownerOrder } from "../config/league.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { strategyAuctionOverridesFor } from "../src/modeling/interactiveMockDraft.js";
import { runMockBatch, runMockBatchProgressively } from "../src/modeling/mockBatch.js";
import type { LiveDraftStrategyKey } from "../src/modeling/liveDraftStrategies.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("mock batch simulation", () => {
  it("summarizes deterministic auction batches across seeds", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 2,
      seedPrefix: "batch-smoke",
    });

    expect(batch.runs).toHaveLength(2);
    expect(batch.summary.runCount).toBe(2);
    expect(batch.summary.scenarios).toEqual([
      {
        key: "expected",
        label: "Expected",
        runCount: 2,
        invalidRosterCount: 0,
        averagePickCount: 217,
      },
    ]);

    const jahmyr = batch.summary.players.find(player => player.name === "Jahmyr Gibbs");
    expect(jahmyr).toBeDefined();
    expect(jahmyr?.draftedCount).toBe(2);
    expect(jahmyr?.averageSalePrice).toBeGreaterThan(70);
    expect(jahmyr?.minimumSalePrice).toBeLessThanOrEqual(jahmyr?.maximumSalePrice ?? 0);

    expect(batch.summary.owners).toHaveLength(ownerOrder.length);
    expect(batch.summary.owners.every(owner => owner.invalidRosterCount === 0)).toBe(true);
    expect(batch.summary.owners.every(owner => owner.averageSpend <= 200)).toBe(true);

    const firstRun = batch.runs[0];
    if (!firstRun) throw new Error("Expected at least one run.");
    expect(firstRun.budgetTrajectory).toHaveLength((firstRun.pickCount + 1) * ownerOrder.length);
    expect(firstRun.budgetTrajectory[0]).toEqual(expect.objectContaining({
      event: "initial",
      pick: 0,
      owner: ownerOrder[0],
      budgetRemaining: expect.any(Number),
      initialSpend: expect.any(Number),
      auctionSpend: 0,
      rosterSlotsRemaining: expect.any(Number),
      maxBid: expect.any(Number),
    }));
    const finalSnapshots = firstRun.budgetTrajectory.filter(row => row.pick === firstRun.pickCount);
    expect(finalSnapshots).toHaveLength(ownerOrder.length);
    expect(finalSnapshots.every(row => row.rosterSlotsRemaining === 0)).toBe(true);
    for (const roster of firstRun.rosters) {
      const finalSnapshot = finalSnapshots.find(row => row.owner === roster.owner);
      expect(finalSnapshot?.spent).toBe(roster.spend);
      expect(finalSnapshot?.budgetRemaining).toBe(roster.budgetRemaining);
      expect(finalSnapshot?.initialSpend ?? 0).toBeGreaterThanOrEqual(0);
      expect(finalSnapshot?.auctionSpend ?? 0).toBeGreaterThanOrEqual(0);
      expect((finalSnapshot?.initialSpend ?? 0) + (finalSnapshot?.auctionSpend ?? 0)).toBe(roster.spend);
      expect(finalSnapshot?.budgetPerRosterSlot).toBeNull();
    }

    const exposure = batch.summary.ownerPlayerExposure.find(entry => entry.player === "Jahmyr Gibbs");
    expect(exposure).toBeDefined();
    expect(exposure?.draftedCount).toBeGreaterThan(0);
  }, 15000);

  it("can run lightweight batches for draft-plan mining without heavy diagnostics", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const baseOptions = {
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"] as const,
      runsPerScenario: 1,
      seedPrefix: "batch-lightweight",
    };
    const fullBatch = runMockBatch(baseOptions);
    const lightweightBatch = runMockBatch({
      ...baseOptions,
      diagnosticsMode: "summary",
    });
    const fullRun = fullBatch.runs[0];
    const lightweightRun = lightweightBatch.runs[0];
    if (!fullRun || !lightweightRun) throw new Error("Expected both batches to produce a run.");

    expect(lightweightRun.seed).toBe(fullRun.seed);
    expect(lightweightRun.pickCount).toBe(fullRun.pickCount);
    expect(lightweightRun.budgetTrajectory).toEqual([]);
    expect(lightweightRun.picks).toHaveLength(fullRun.picks.length);
    expect(lightweightRun.picks.every(pick => pick.topBids.length === 0)).toBe(true);
    expect(lightweightRun.picks.map(pick => ({
      owner: pick.owner,
      player: pick.player,
      price: pick.price,
    }))).toEqual(fullRun.picks.map(pick => ({
      owner: pick.owner,
      player: pick.player,
      price: pick.price,
    })));
    expect(lightweightRun.rosters.map(roster => ({
      owner: roster.owner,
      spend: roster.spend,
      budgetRemaining: roster.budgetRemaining,
      valid: roster.valid,
    }))).toEqual(fullRun.rosters.map(roster => ({
      owner: roster.owner,
      spend: roster.spend,
      budgetRemaining: roster.budgetRemaining,
      valid: roster.valid,
    })));
  }, 15000);

  it("starts mocks from forced Owner11 purchases before AI owners fill the room", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const run = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 1,
      seedPrefix: "forced-sale",
      diagnosticsMode: "summary",
      forcedSales: [
        { owner: "Owner11", player: "Puka Nacua", price: 75 },
      ],
    }).runs[0];
    const baselineRun = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 1,
      seedPrefix: "forced-sale-baseline",
      diagnosticsMode: "summary",
    }).runs[0];
    if (!run) throw new Error("Expected a forced-sale mock run.");
    if (!baselineRun) throw new Error("Expected a baseline mock run.");

    const owner11 = run.rosters.find(roster => roster.owner === "Owner11");
    const puka = owner11?.players.find(player => player.name === "Puka Nacua");

    expect(puka).toMatchObject({
      position: "WR",
      price: 75,
    });
    expect(owner11?.players.some(player => player.name === "Ashton Jeanty" && player.price === 50)).toBe(true);
    expect(run.picks.some(pick => pick.player === "Puka Nacua")).toBe(false);
    expect(run.inputCounts.auctionPlayers).toBe(baselineRun.inputCounts.auctionPlayers - 1);
    expect(run.pickCount).toBe(216);
    expect(owner11?.valid).toBe(true);
  }, 15000);

  it("rejects forced purchases that Owner11 could not legally afford", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();

    expect(() => runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 1,
      seedPrefix: "forced-sale-over-max",
      diagnosticsMode: "summary",
      forcedSales: [
        { owner: "Owner11", player: "Puka Nacua", price: 190 },
      ],
    })).toThrow("Owner11 cannot force Puka Nacua for $190: max bid is $136.");
  }, 15000);

  it("keeps owner personality profiles from locking the same elite RB pair every run", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 20,
      seedPrefix: "personality-lock",
      diagnosticsMode: "summary",
    });
    const draftedOwnerFor = (
      run: (typeof batch.runs)[number],
      playerName: string,
    ): string | undefined =>
      run.rosters.find(roster => roster.players.some(player => player.name === playerName))?.owner;
    const beatonBothCount = batch.runs.filter(run =>
      draftedOwnerFor(run, "Jahmyr Gibbs") === "Owner01" &&
      draftedOwnerFor(run, "Bijan Robinson") === "Owner01",
    ).length;
    const beatonAtLeastOneCount = batch.runs.filter(run =>
      draftedOwnerFor(run, "Jahmyr Gibbs") === "Owner01" ||
      draftedOwnerFor(run, "Bijan Robinson") === "Owner01",
    ).length;
    const eliteRbOwnerPairs = new Set(batch.runs.map(run => [
      draftedOwnerFor(run, "Jahmyr Gibbs"),
      draftedOwnerFor(run, "Bijan Robinson"),
    ].join(":")));

    expect(beatonAtLeastOneCount).toBeGreaterThan(0);
    expect(beatonBothCount).toBeLessThan(batch.runs.length);
    expect(eliteRbOwnerPairs.size).toBeGreaterThan(1);
  }, 15000);

  it("keeps owner tendencies from becoming deterministic draft scripts", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 30,
      seedPrefix: "profile-variance-regression",
      diagnosticsMode: "summary",
    });
    const rosterFor = (
      run: (typeof batch.runs)[number],
      owner: string,
    ) => {
      const roster = run.rosters.find(candidate => candidate.owner === owner);
      if (!roster) throw new Error(`Missing ${owner} roster.`);
      return roster;
    };
    const seasonWinnerCounts = new Map<string, number>();

    for (const run of batch.runs) {
      const winner = [...run.rosters]
        .sort((left, right) => (right.weeks1To4Score ?? 0) - (left.weeks1To4Score ?? 0))[0];
      if (!winner) throw new Error("Missing season winner.");
      seasonWinnerCounts.set(winner.owner, (seasonWinnerCounts.get(winner.owner) ?? 0) + 1);
    }

    const melloExpensiveStudCounts = new Set(batch.runs.map(run =>
      rosterFor(run, "Owner14").players.filter(player => player.price >= 50).length
    ));
    const jakubTopTightEndCount = batch.runs.filter(run =>
      rosterFor(run, "Owner05").players.some(player => player.position === "TE" && player.price >= 25)
    ).length;
    const largestWinnerCount = Math.max(...seasonWinnerCounts.values());

    expect(melloExpensiveStudCounts.size).toBeGreaterThan(1);
    expect(jakubTopTightEndCount).toBeLessThan(batch.runs.length);
    expect(largestWinnerCount).toBeLessThan(15);
  }, 20000);

  it("varies Owner11's true 3RB cores across live-style batch runs", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const strategySequence = [
      "three-rb",
      "balanced",
      "hero-rb",
      "wr-heavy",
    ] as const satisfies readonly LiveDraftStrategyKey[];
    const batch = await runMockBatchProgressively({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 24,
      seedPrefix: "owner11-three-rb-variance",
      diagnosticsMode: "summary",
      auctionConfigOverridesForRun: context =>
        strategyAuctionOverridesFor(
          "Owner11",
          strategySequence[context.completedRuns % strategySequence.length] ?? "three-rb",
          { variantSeed: context.seed },
        ),
    });
    const camRbCoreFor = (run: (typeof batch.runs)[number]): string[] => {
      const camRoster = run.rosters.find(roster => roster.owner === "Owner11");
      if (!camRoster) throw new Error("Missing Owner11 roster.");

      return camRoster.players
        .filter(player => player.position === "RB")
        .sort((left, right) => right.price - left.price || left.name.localeCompare(right.name))
        .slice(0, 3)
        .map(player => player.name);
    };
    const threeRbRuns = batch.runs.filter(
      (_run, index) => strategySequence[index % strategySequence.length] === "three-rb",
    );
    const rbCores = threeRbRuns.map(camRbCoreFor);
    const uniqueRbCores = new Set(rbCores.map(core => core.join("|")));
    const hasKeeperPlusFlexibleAuctionCore = threeRbRuns.some(run => {
      const camRoster = run.rosters.find(roster => roster.owner === "Owner11");
      if (!camRoster) throw new Error("Missing Owner11 roster.");
      const rbPrices = camRoster.players
        .filter(player => player.position === "RB")
        .map(player => player.price)
        .sort((left, right) => right - left);
      return (rbPrices[0] ?? 0) >= 60 &&
        (rbPrices[1] ?? 0) === 50 &&
        (rbPrices[2] ?? 0) <= 40 &&
        (rbPrices[2] ?? 0) >= 20;
    });

    expect(rbCores.every(core => core.length === 3)).toBe(true);
    expect(rbCores.every(core => core.includes("Ashton Jeanty"))).toBe(true);
    expect(uniqueRbCores.size).toBeGreaterThan(1);
    expect(hasKeeperPlusFlexibleAuctionCore).toBe(true);
  }, 20000);

  it("does not let mock owners finish with unusable budget piles", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 10,
      seedPrefix: "budget-leftover-regression",
      diagnosticsMode: "summary",
    });

    const largestBudgetRemaining = Math.max(
      ...batch.runs.flatMap(run => run.rosters.map(roster => roster.budgetRemaining)),
    );

    expect(largestBudgetRemaining).toBeLessThanOrEqual(8);
  }, 20000);
});
