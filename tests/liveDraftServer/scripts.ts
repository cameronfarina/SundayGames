import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import type { RunMockBatchOptions } from "../../src/modeling/mockBatch.js";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory, waitForMockBatchJob } from "./support/serverHarness.js";

export const registerScriptTests = (): void => {
  it("accepts scripted mock targets and applies Owner11 max-bid caps to the batch job", async () => {
    const directory = await tempSessionDirectory();
    let capturedOptions: RunMockBatchOptions | undefined;
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner: options => {
          capturedOptions = options;
          return mockBatchRunner(options);
        },
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const started = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "three-rb",
        runs: 25,
        seedPrefix: "script-test",
        script: "run 2 mocks where i target jadarian price, where im not willing to pay over $20",
      });
      const completed = await waitForMockBatchJob(baseUrl, started.data.jobId);

      expect(capturedOptions?.runsPerScenario).toBe(2);
      expect(started.data.runsPerScenario).toBe(2);
      expect(started.data.runStrategyKeys).toEqual(["three-rb", "balanced"]);
      expect(capturedOptions?.auctionConfigOverrides?.ownerPlayerTargetMaxBids?.Owner11?.["Jadarian Price"]).toBe(20);
      expect(completed.result.script).toMatchObject({
        label: "Target Jadarian Price up to $20",
        targetOutcomes: [
          expect.objectContaining({
            owner: "Owner11",
            player: "Jadarian Price",
            maxBid: 20,
            runCount: 2,
          }),
        ],
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects ambiguous scripted mock player names before starting a batch job", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const started = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "three-rb",
        runs: 2,
        seedPrefix: "ambiguous-script-test",
        script: "target Williams max 20",
      });

      expect(started.status).toBe(422);
      expect(started.data.error).toContain('Ambiguous mock script player "Williams"');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("accepts build-around mock scripts and runs each price point as a forced Owner11 start", async () => {
    const directory = await tempSessionDirectory();
    const capturedOptions: RunMockBatchOptions[] = [];
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner: options => {
          capturedOptions.push(options);
          return mockBatchRunner(options);
        },
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const started = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "three-rb",
        runs: 2,
        seedPrefix: "build-around-server-test",
        script: "build around omarion hampton at 46-50:2; target zay flowers max 31",
      });
      const completed = await waitForMockBatchJob(baseUrl, started.data.jobId);

      expect(started.data.totalRuns).toBe(6);
      expect(started.data.runStrategyKeys).toEqual([
        "three-rb",
        "balanced",
        "three-rb",
        "balanced",
        "three-rb",
        "balanced",
      ]);
      expect(completed.status).toBe("complete");
      expect(completed.result.summary.runCount).toBe(6);
      expect(completed.result.script).toMatchObject({
        label: "Build around Omarion Hampton at $46/$48/$50 / Target Zay Flowers up to $31",
        buildAround: {
          owner: "Owner11",
          player: "Omarion Hampton",
          prices: [46, 48, 50],
        },
      });
      expect(completed.result.runs.map((run: { label: string }) => run.label)).toEqual([
        "Run 1: Hampton $46 / 3RB",
        "Run 2: Hampton $46 / Balanced",
        "Run 3: Hampton $48 / 3RB",
        "Run 4: Hampton $48 / Balanced",
        "Run 5: Hampton $50 / 3RB",
        "Run 6: Hampton $50 / Balanced",
      ]);
      expect(capturedOptions.map(options => options.forcedSales)).toEqual([
        [{ owner: "Owner11", player: "Omarion Hampton", price: 46 }],
        [{ owner: "Owner11", player: "Omarion Hampton", price: 48 }],
        [{ owner: "Owner11", player: "Omarion Hampton", price: 50 }],
      ]);
      for (const options of capturedOptions) {
        expect(options.runsPerScenario).toBe(2);
        expect(options.auctionConfigOverrides?.ownerPlayerTargetMaxBids?.Owner11?.["Zay Flowers"]).toBe(31);
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
