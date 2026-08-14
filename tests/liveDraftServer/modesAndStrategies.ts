import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft, mockSaleCommand, realSaleCommand } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory, waitForMockBatchJob } from "./support/serverHarness.js";

export const registerModeAndStrategyTests = (): void => {
  it("keeps real draft actions, interactive practice actions, and bulk mocks in distinct modes", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const realSale = await post(baseUrl, "/api/events", {
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      expect(realSale.status).toBe(200);
      expect(realSale.data.draftMode).toBe("real");
      expect(realSale.data.session.commandCount).toBe(1);
      expect(realSale.data.session.paths.directory).toBe(directory);
      expect(realSale.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const practiceBefore = await fetch(`${baseUrl}/api/state?draftSession=practice-3rb&mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(practiceBefore.draftMode).toBe("interactive-mock");
      expect(practiceBefore.session.commandCount).toBe(0);
      expect(practiceBefore.events).toHaveLength(0);

      const practiceSale = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "separate-mode-test",
        action: "advance",
      });
      expect(practiceSale.status).toBe(200);
      expect(practiceSale.data.draftMode).toBe("interactive-mock");
      expect(practiceSale.data.session.commandCount).toBe(1);
      expect(practiceSale.data.events.map((event: { input: string }) => event.input)).toEqual([mockSaleCommand]);

      const realAfterPractice = await fetch(`${baseUrl}/api/state?mode=real&strategy=three-rb`)
        .then(response => response.json());
      expect(realAfterPractice.draftMode).toBe("real");
      expect(realAfterPractice.session.commandCount).toBe(1);
      expect(realAfterPractice.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const batch = await post(baseUrl, "/api/mock-batch", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        runs: 3,
        seedPrefix: "server-batch",
      });
      expect(batch.status).toBe(202);
      expect(batch.data.status).toMatch(/queued|running|complete/);
      expect(batch.data.totalRuns).toBe(3);

      const completedBatch = await waitForMockBatchJob(baseUrl, batch.data.jobId, "Owner11", "practice-3rb");
      expect(completedBatch.status).toBe("complete");
      expect(completedBatch.percent).toBe(100);
      expect(completedBatch.result.mode).toBe("batch-mock");
      expect(completedBatch.result.summary.runCount).toBe(3);
      expect(completedBatch.result.cam.owner).toBe("Owner11");
      expect(completedBatch.result.camTopExposures).toEqual([
        expect.objectContaining({ player: "Jahmyr Gibbs", draftedRate: 1 }),
      ]);

      const realAfterBatch = await fetch(`${baseUrl}/api/state?mode=real&strategy=three-rb`)
        .then(response => response.json());
      const practiceAfterBatch = await fetch(`${baseUrl}/api/state?draftSession=practice-3rb&mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(realAfterBatch.session.commandCount).toBe(1);
      expect(practiceAfterBatch.session.commandCount).toBe(1);
      expect(practiceAfterBatch.postDraftAudit[0]).toMatchObject({
        player: "Jahmyr Gibbs",
        mockRange: {
          averageSalePrice: 77,
          minimumSalePrice: 76,
          maximumSalePrice: 78,
          draftedRate: 1,
        },
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("scopes post-draft mock ranges to the matching batch strategy", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const wrongStrategyBatch = await post(baseUrl, "/api/mock-batch", {
        draftSession: "practice-3rb",
        strategyKey: "wr-heavy",
        runs: 1,
        seedPrefix: "wrong-audit-range",
      });
      await waitForMockBatchJob(baseUrl, wrongStrategyBatch.data.jobId, "Owner11", "practice-3rb");

      const sale = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "audit-scope-sale",
        action: "advance",
      });
      expect(sale.status).toBe(200);
      expect(sale.data.postDraftAudit[0]).toMatchObject({ player: "Jahmyr Gibbs" });
      expect(sale.data.postDraftAudit[0].mockRange).toBeUndefined();

      const matchingStrategyBatch = await post(baseUrl, "/api/mock-batch", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        runs: 1,
        seedPrefix: "matching-audit-range",
      });
      await waitForMockBatchJob(baseUrl, matchingStrategyBatch.data.jobId, "Owner11", "practice-3rb");

      const scopedState = await fetch(`${baseUrl}/api/state?draftSession=practice-3rb&mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(scopedState.postDraftAudit[0].mockRange).toMatchObject({
        averageSalePrice: 77,
        minimumSalePrice: 76,
        maximumSalePrice: 78,
        draftedRate: 1,
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
