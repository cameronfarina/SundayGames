import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerRealMockSaleTests = (): void => {
  it("applies a real AI mock sale before returning the next nomination", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);
      const openingCommand = "Owner11 drafted Jahmyr Gibbs for 80";

      const setup = await post(baseUrl, "/api/events", {
        mode: "interactive-mock",
        draftSession: "scratch:real-ai-sale",
        strategyKey: "three-rb",
        command: openingCommand,
      });
      expect(setup.status).toBe(200);

      const preview = await fetch(`${baseUrl}/api/mock/state?draftSession=scratch:real-ai-sale&strategy=three-rb&seed=y`)
        .then(response => response.json());
      const soldPlayer = preview.mockDraft.auction.player;
      const winner = preview.mockDraft.auction.resolution.owner;
      const saleCommand = preview.mockDraft.aiSaleCommand;

      expect(preview.session.commandCount).toBe(1);
      expect(preview.mockDraft.phase).toBe("ai-sale");
      expect(preview.mockDraft.auction.feed.map((event: { type: string }) => event.type)).not.toContain("sold");

      const advanced = await post(baseUrl, "/api/mock/advance", {
        draftSession: "scratch:real-ai-sale",
        strategyKey: "three-rb",
        seed: "y",
        action: "pass",
      });

      expect(advanced.status).toBe(200);
      expect(advanced.data.session.commandCount).toBe(2);
      expect(advanced.data.events.map((event: { input: string }) => event.input)).toEqual([openingCommand, saleCommand]);
      expect(advanced.data.availableTargets.map((target: { name: string }) => target.name)).not.toContain(soldPlayer);
      expect(
        advanced.data.owners
          .find((owner: { owner: string }) => owner.owner === winner)
          .roster
          .map((player: { name: string }) => player.name),
      ).toContain(soldPlayer);
      expect(advanced.data.mockDraft.nomination?.player).not.toBe(soldPlayer);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
