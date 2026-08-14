import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerNewsFallbackTests = (): void => {
  it("keeps all-source player news useful when the optional remote provider fails", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
        playerNewsProvider: async () => {
          throw new Error("provider down");
        },
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const defaultSources = await fetch(`${baseUrl}/api/player-news`);
      expect(defaultSources.status).toBe(200);
      const defaultSourcesData = await defaultSources.json();
      expect(defaultSourcesData.sourceMode).toBe("all");
      expect(defaultSourcesData.summary.totalCount).toBeGreaterThan(0);
      expect(defaultSourcesData.items.length).toBeGreaterThan(0);

      const allSources = await fetch(`${baseUrl}/api/player-news?source=all`);
      expect(allSources.status).toBe(200);
      const allSourcesData = await allSources.json();
      expect(allSourcesData.sourceMode).toBe("all");
      expect(allSourcesData.summary.totalCount).toBeGreaterThan(0);
      expect(allSourcesData.items.length).toBeGreaterThan(0);

      const localOnly = await fetch(`${baseUrl}/api/player-news?source=local`);
      expect(localOnly.status).toBe(200);
      const localOnlyData = await localOnly.json();
      expect(localOnlyData.sourceMode).toBe("local");
      expect(localOnlyData.summary.totalCount).toBeGreaterThan(0);

      const remoteOnly = await fetch(`${baseUrl}/api/player-news?source=rotowire-rss`);
      expect(remoteOnly.status).toBe(500);
      await expect(remoteOnly.json()).resolves.toEqual({
        error: "provider down",
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
};
