import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerNewsTests = (): void => {
  it("serves the local evidence-backed player news API", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
        playerNewsProvider: async () => [{
          provider: "rotowire-rss",
          providerItemId: "rss-trey-benson",
          playerName: "Trey Benson",
          title: "Tending to sore knee",
          summary: "Benson is dealing with discomfort in his left knee.",
          publishedAt: "2026-08-03T22:00:00.000Z",
          fetchedAt: "2026-08-03T22:30:00.000Z",
          tags: ["Injury"],
          raw: {},
        }],
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const response = await fetch(`${baseUrl}/api/player-news?strategy=three-rb&category=Injury`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary.totalCount).toBeGreaterThan(0);
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.items.every((item: { category: string }) => item.category === "Injury")).toBe(true);
      expect(data.items[0]).toEqual(expect.objectContaining({
        player: expect.any(String),
        headline: expect.any(String),
        fantasyImpact: expect.any(String),
        draftAction: expect.stringMatching(/Fade|Move up|Watch|No model change/),
        source: expect.objectContaining({ provider: expect.any(String) }),
      }));
      expect(data.providers).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "local-evidence", status: "active" }),
        expect.objectContaining({ key: "sportsdataio", status: "candidate" }),
      ]));

      const rssResponse = await fetch(`${baseUrl}/api/player-news?source=rotowire-rss&q=Trey%20Benson`);
      expect(rssResponse.status).toBe(200);
      const rssData = await rssResponse.json();
      expect(rssData.items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          player: "Trey Benson",
          position: "RB",
          teamAbbreviation: "ARI",
        }),
      ]));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
