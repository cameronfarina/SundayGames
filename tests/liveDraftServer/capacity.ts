import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { MockBatchResourceManager } from "../../src/mockBatchResourceManager.js";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory, waitForMockBatchJob } from "./support/serverHarness.js";

export const registerCapacityTests = (): void => {
  it("returns Retry-After when shared mock capacity is exhausted", async () => {
    const directory = await tempSessionDirectory();
    const manager = new MockBatchResourceManager({
      maxRunningGlobal: 1,
      maxRunningPerAccount: 1,
      maxRunningPerSeason: 1,
      maxQueuedGlobal: 1,
      maxQueuedPerAccount: 1,
      maxQueuedPerSeason: 1,
      retryAfterSeconds: 9,
    });
    let releaseRunning = (): void => undefined;
    const running = new Promise<void>(resolve => {
      releaseRunning = resolve;
    });
    manager.submit({ accountId: "other-a", seasonId: "other-a" }, () => running);
    manager.submit({ accountId: "other-b", seasonId: "other-b" }, async () => undefined);

    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
        mockBatchResourceManager: manager,
        mockBatchResourceScope: { accountId: "account-owner11", seasonId: "season-2026" },
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const response = await fetch(`${baseUrl}/api/mock-batch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strategyKey: "three-rb", runs: 1 }),
      });

      expect(response.status).toBe(503);
      expect(response.headers.get("retry-after")).toBe("9");
      await expect(response.json()).resolves.toEqual({
        error: "Mock draft capacity is temporarily full.",
        code: "global_queue_full",
      });
    } finally {
      releaseRunning();
      await manager.whenIdle();
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("evicts completed mock jobs by count and age", async () => {
    const directory = await tempSessionDirectory();
    let currentTime = new Date("2026-08-12T12:00:00.000Z");
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
        maxCompletedMockBatchJobs: 1,
        completedMockBatchJobTtlMs: 60_000,
        mockBatchNow: () => currentTime,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const first = await post(baseUrl, "/api/mock-batch", {
        draftSession: "scratch:first",
        strategyKey: "three-rb",
        runs: 1,
      });
      await waitForMockBatchJob(baseUrl, first.data.jobId, "Owner11", "scratch:first");
      currentTime = new Date("2026-08-12T12:00:30.000Z");
      const second = await post(baseUrl, "/api/mock-batch", {
        draftSession: "scratch:second",
        strategyKey: "three-rb",
        runs: 1,
      });
      await waitForMockBatchJob(baseUrl, second.data.jobId, "Owner11", "scratch:second");
      expect(app.canDispose?.()).toBe(false);

      const firstAfterCountEviction = await fetch(
        `${baseUrl}/api/mock-batch/${encodeURIComponent(first.data.jobId)}?owner=Owner11&draftSession=scratch%3Afirst`,
      );
      expect(firstAfterCountEviction.status).toBe(404);

      currentTime = new Date("2026-08-12T12:02:00.000Z");
      expect(app.canDispose?.()).toBe(true);
      const secondAfterTtl = await fetch(
        `${baseUrl}/api/mock-batch/${encodeURIComponent(second.data.jobId)}?owner=Owner11&draftSession=scratch%3Asecond`,
      );
      expect(secondAfterTtl.status).toBe(404);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
