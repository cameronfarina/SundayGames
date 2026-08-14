import { describe, expect, it } from "vitest";
import type { ForcedAuctionSale } from "../../src/modeling/mockBatch.js";
import {
  InMemorySimulationRepository,
  executeSimulationRun,
} from "../../src/platform/simulations.js";
import { baseRequestInput, fakeBatch, now, softTargets } from "./support.js";

describe("private simulation execution", () => {
  it("maps hard locks to forced sales and persists a runner result summary", async () => {
    const repository = new InMemorySimulationRepository();
    const run = repository.createRequest({
      ...baseRequestInput,
      strategy: {
        hardLocks: [
          {
            playerName: "Jadarian Price",
            price: 13,
            priceMode: "exact",
            auctionOwner: "Owner11",
          },
          {
            playerName: "Kenneth Walker III",
            price: 30,
            priceMode: "ceiling",
            auctionOwner: "Owner11",
          },
        ],
        softTargets,
      },
      createdAt: now,
    });
    const runnerCalls: Array<{
      runsPerScenario: number;
      seedPrefix: string;
      forcedSales: readonly ForcedAuctionSale[];
    }> = [];

    const completedRun = await executeSimulationRun({
      repository,
      runId: run.id,
      runner: options => {
        runnerCalls.push(options);
        return fakeBatch(options);
      },
      now: new Date(now.getTime() + 5_000),
    });

    expect(runnerCalls).toEqual([expect.objectContaining({
      runsPerScenario: 25,
      seedPrefix: "owner11-balanced-rb3",
      forcedSales: [
        { owner: "Owner11", player: "Jadarian Price", price: 13 },
        { owner: "Owner11", player: "Kenneth Walker III", price: 30 },
      ],
      hardLocks: [
        {
          playerName: "Jadarian Price",
          price: 13,
          priceMode: "exact",
          auctionOwner: "Owner11",
        },
        {
          playerName: "Kenneth Walker III",
          price: 30,
          priceMode: "ceiling",
          auctionOwner: "Owner11",
        },
      ],
      softTargets: [
        {
          label: "good-not-elite-rb2",
          candidatePool: ["Breece Hall", "Kenneth Walker III", "Chase Brown"],
          maxBid: 35,
        },
        {
          label: "value-wrs",
          candidatePool: ["Davante Adams", "Zay Flowers", "Tee Higgins", "Ladd McConkey"],
          maxBid: 22,
        },
      ],
    })]);
    expect(completedRun.status).toBe("completed");
    expect(completedRun.result).toMatchObject({
      runId: run.id,
      requestId: run.request.id,
      runCount: 25,
      seedPrefix: "owner11-balanced-rb3",
      hardLockCount: 2,
      softTargetCount: 2,
      forcedSales: [
        { owner: "Owner11", player: "Jadarian Price", price: 13 },
        { owner: "Owner11", player: "Kenneth Walker III", price: 30 },
      ],
      summary: { runCount: 25 },
    });
    expect(repository.fetchForUser(run.id, "user_cam")?.result).toBe(completedRun.result);
  });
});
