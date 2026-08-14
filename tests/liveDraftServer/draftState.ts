import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { interactiveMockDraft, mockSaleCommand } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerDraftStateTests = (): void => {
  it("serves the draft board with the same default sourced evidence as prep commands", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const state = await fetch(`${baseUrl}/api/state?strategy=three-rb`).then(response => response.json());
      const gibbs = state.availableTargets.find((target: { name: string }) => target.name === "Jahmyr Gibbs");
      const london = state.availableTargets.find((target: { name: string }) => target.name === "Drake London");

      expect(gibbs).toMatchObject({
        expectedPrice: 72,
        personalValue: 80,
        recommendedMaxBid: 76,
        draftRoomRank: {
          sourceLabel: "Average Half PPR",
          platformRank: 1.3,
          landmineScore: 5.5,
        },
      });
      expect(london).toMatchObject({
        expectedPrice: 46,
        personalValue: expect.any(Number),
        recommendedMaxBid: 26,
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serves strategy-aware state and advances interactive mock actions through persisted commands", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const strategyState = await fetch(`${baseUrl}/api/state?strategy=wr-heavy`).then(response => response.json());
      expect(strategyState.strategy.key).toBe("wr-heavy");
      expect(strategyState.draftMode).toBe("real");

      const mockState = await fetch(`${baseUrl}/api/mock/state?draftSession=practice-3rb&strategy=three-rb&seed=server-test`)
        .then(response => response.json());
      expect(mockState.draftMode).toBe("interactive-mock");
      expect(mockState.strategy.key).toBe("three-rb");
      expect(mockState.mockDraft.strategyKey).toBe("three-rb");
      expect(mockState.mockDraft.seed).toBe("server-test");
      expect(mockState.mockDraft.aiSaleCommand).toContain("drafted");

      const advanced = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-test",
        action: "advance",
      });
      expect(advanced.status).toBe(200);
      expect(advanced.data.events).toHaveLength(1);
      expect(advanced.data.session.commandCount).toBe(1);
      expect(advanced.data.session.paths.directory).toBe(join(directory, "practice-3rb", "interactive-mock"));
      expect(advanced.data.mockDraft.commandCount).toBe(1);

      const undone = await post(baseUrl, "/api/undo", {
        draftSession: "practice-3rb",
        mode: "interactive-mock",
        strategyKey: "wr-heavy",
      });
      expect(undone.status).toBe(200);
      expect(undone.data.strategy.key).toBe("wr-heavy");
      expect(undone.data.draftMode).toBe("interactive-mock");
      expect(undone.data.session.commandCount).toBe(0);

      const sale = await post(baseUrl, "/api/events", {
        strategyKey: "wr-heavy",
        command: mockSaleCommand,
      });
      expect(sale.status).toBe(200);
      expect(sale.data.strategy.key).toBe("wr-heavy");
      expect(sale.data.session.commandCount).toBe(1);

      const reset = await post(baseUrl, "/api/reset", {
        strategyKey: "balanced",
        confirmReset: true,
        expectedCommandCount: 1,
      });
      expect(reset.status).toBe(200);
      expect(reset.data.strategy.key).toBe("balanced");
      expect(reset.data.session.commandCount).toBe(0);

      const imported = await post(baseUrl, "/api/import", {
        strategyKey: "three-rb",
        confirmImport: true,
        expectedCommandCount: 0,
        commands: [mockSaleCommand],
      });
      expect(imported.status).toBe(200);
      expect(imported.data.strategy.key).toBe("three-rb");
      expect(imported.data.session.commandCount).toBe(1);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
