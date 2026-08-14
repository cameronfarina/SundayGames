import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { ownerOrder } from "../../config/league.js";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory, waitForMockBatchJob } from "./support/serverHarness.js";

export const registerInteractiveJobTests = (): void => {
  it("publishes interactive mock completion as a viewable one-run results job", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const complete = await post(baseUrl, "/api/mock/advance", {
        draftSession: "scratch:completion-results",
        strategyKey: "three-rb",
        seed: "server-complete-results",
        action: "complete-mock",
      });

      expect(complete.status).toBe(200);
      expect(complete.data.mockBatchJob).toMatchObject({
        status: "complete",
        source: "interactive-complete",
        strategyKey: "three-rb",
        runsPerScenario: 1,
        totalRuns: 1,
        completedRuns: 1,
        percent: 100,
      });
      expect(complete.data.mockBatchJob.result.runs).toHaveLength(1);
      expect(complete.data.mockBatchJob.result.runs[0].teams).toHaveLength(ownerOrder.length);
      expect(complete.data.mockBatchJob.result.runs[0].rankings).toHaveLength(ownerOrder.length);
      expect(complete.data.mockBatchJob.result.runs[0].teams[0]).toEqual(expect.objectContaining({
        week1Score: expect.any(Number),
        projectedRank: expect.any(Number),
        rankExplanation: expect.stringContaining("Projected"),
      }));

      const latest = await fetch(
        `${baseUrl}/api/mock-batch/latest?draftSession=scratch%3Acompletion-results&owner=Owner11`,
      ).then(response => response.json());
      expect(latest.jobId).toBe(complete.data.mockBatchJob.jobId);
      expect(latest.result.runs[0].label).toBe("Completed mock draft");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }, 20_000);

  it("uses the request owner for interactive mock state", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const response = await fetch(
        `${baseUrl}/api/mock/state?draftSession=practice-3rb&strategy=three-rb&owner=Owner02`,
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.watchOwner.owner).toBe("Owner02");
      expect(data.mockDraft.watchOwner).toBe("Owner02");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("scopes latest mock results and direct job access by owner and draft session", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const camJob = await post(baseUrl, "/api/mock-batch", {
        owner: "Owner11",
        draftSession: "scratch:owner11-results",
        strategyKey: "three-rb",
        runs: 1,
        seedPrefix: "owner11-scoped-results",
      });
      await waitForMockBatchJob(baseUrl, camJob.data.jobId, "Owner11", "scratch:owner11-results");

      const hoodyJob = await post(baseUrl, "/api/mock-batch", {
        owner: "Owner02",
        draftSession: "scratch:owner02-results",
        strategyKey: "wr-heavy",
        runs: 1,
        seedPrefix: "owner02-scoped-results",
      });
      await waitForMockBatchJob(baseUrl, hoodyJob.data.jobId, "Owner02", "scratch:owner02-results");

      const camLatestResponse = await fetch(
        `${baseUrl}/api/mock-batch/latest?owner=Owner11&draftSession=scratch%3Aowner11-results`,
      );
      const camLatest = await camLatestResponse.json();
      const wrongOwnerResponse = await fetch(
        `${baseUrl}/api/mock-batch/${encodeURIComponent(camJob.data.jobId)}?owner=Owner02&draftSession=scratch%3Aowner11-results`,
      );

      expect(camLatestResponse.status).toBe(200);
      expect(camLatest.jobId).toBe(camJob.data.jobId);
      expect(camLatest.watchOwner).toBe("Owner11");
      expect(camLatest.draftSessionKey).toBe("scratch:owner11-results");
      expect(wrongOwnerResponse.status).toBe(404);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
