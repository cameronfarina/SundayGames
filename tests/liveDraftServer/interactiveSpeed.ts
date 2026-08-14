import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { ownerOrder } from "../../config/league.js";
import { interactiveMockDraft, mockAiSaleCommands } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerInteractiveSpeedTests = (): void => {
  it("runs interactive mock speed controls through persisted sale commands", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const nextCamDecision = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-wr-heavy",
        strategyKey: "wr-heavy",
        seed: "server-speed-controls",
        action: "next-cam-decision",
      });
      expect(nextCamDecision.status).toBe(200);
      expect(nextCamDecision.data.session.commandCount).toBe(2);
      expect(nextCamDecision.data.events.map((event: { input: string }) => event.input)).toEqual([
        mockAiSaleCommands[0],
        mockAiSaleCommands[1],
      ]);
      expect(nextCamDecision.data.mockDraft.phase).toBe("human-decision");

      const complete = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-wr-heavy",
        strategyKey: "wr-heavy",
        seed: "server-speed-controls",
        action: "complete-mock",
      });
      expect(complete.status).toBe(200);
      expect(complete.data.session.commandCount).toBeGreaterThan(2);
      expect(complete.data.mockBatchJob).toMatchObject({
        status: "complete",
        source: "interactive-complete",
        totalRuns: 1,
        percent: 100,
      });
      expect(complete.data.mockBatchJob.result.runs[0].teams).toHaveLength(ownerOrder.length);
      expect(complete.data.mockBatchJob.result.runs[0].rankings).toHaveLength(ownerOrder.length);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }, 20_000);

};
