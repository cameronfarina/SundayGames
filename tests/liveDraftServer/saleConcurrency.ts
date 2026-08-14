import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft, realSaleCommand } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerSaleConcurrencyTests = (): void => {
  it("serializes live sale validation so duplicate concurrent purchases cannot both write", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const [firstSale, duplicateSale] = await Promise.all([
        post(baseUrl, "/api/events", {
          draftSession: "live",
          mode: "real",
          strategyKey: "three-rb",
          command: realSaleCommand,
        }),
        post(baseUrl, "/api/events", {
          draftSession: "live",
          mode: "real",
          strategyKey: "three-rb",
          command: realSaleCommand,
        }),
      ]);
      const statuses = [firstSale.status, duplicateSale.status].sort((left, right) => left - right);
      const state = await fetch(`${baseUrl}/api/state?draftSession=live&mode=real&strategy=three-rb`)
        .then(response => response.json());

      expect(statuses).toEqual([200, 422]);
      expect(state.session.commandCount).toBe(1);
      expect(state.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
      expect(state.errors).toHaveLength(0);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
