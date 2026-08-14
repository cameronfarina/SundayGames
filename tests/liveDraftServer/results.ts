import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunnerHonoringForcedSales } from "./support/forcedSaleMockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory, waitForMockBatchJob } from "./support/serverHarness.js";

export const registerResultTests = (): void => {
  it("publishes mock results from the active interactive session instead of the latest batch", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner: mockBatchRunnerHonoringForcedSales,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const staleBatch = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "wr-heavy",
        runs: 1,
        seedPrefix: "stale-results",
      });
      await waitForMockBatchJob(baseUrl, staleBatch.data.jobId);

      const sale = await post(baseUrl, "/api/events", {
        draftSession: "scratch:exact-results",
        mode: "interactive-mock",
        strategyKey: "three-rb",
        command: "Owner11 drafted Breece Hall for 42",
      });
      expect(sale.status).toBe(200);

      const published = await post(baseUrl, "/api/mock/session-results", {
        draftSession: "scratch:exact-results",
        strategyKey: "three-rb",
        seed: "session-results",
        expectedCommandCount: 1,
      });

      expect(published.status).toBe(200);
      expect(published.data.mockBatchJob).toMatchObject({
        status: "complete",
        source: "interactive-complete",
        draftSessionKey: "scratch:exact-results",
        draftMode: "interactive-mock",
        commandCount: 1,
        strategyKey: "three-rb",
      });
      const camTeam = published.data.mockBatchJob.result.runs[0].teams
        .find((team: { owner: string }) => team.owner === "Owner11");
      expect(camTeam.players).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "Breece Hall", price: 42 }),
      ]));

      const latest = await fetch(
        `${baseUrl}/api/mock-batch/latest?draftSession=scratch%3Aexact-results&owner=Owner11`,
      ).then(response => response.json());
      expect(latest.jobId).toBe(published.data.mockBatchJob.jobId);
      expect(latest.jobId).not.toBe(staleBatch.data.jobId);
      expect(latest.draftSessionKey).toBe("scratch:exact-results");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
