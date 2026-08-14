import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft, realSaleCommand } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerSessionLockTests = (): void => {
  it("returns an empty latest mock batch response before a batch has run", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const response = await fetch(`${baseUrl}/api/mock-batch/latest`);
      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("locks live draft-night sessions against interactive mock advances", async () => {
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
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      expect(realSale.status).toBe(200);

      const lockedAdvance = await post(baseUrl, "/api/mock/advance", {
        draftSession: "live",
        strategyKey: "three-rb",
        seed: "locked-live-session",
        action: "advance",
      });
      expect(lockedAdvance.status).toBe(423);
      expect(lockedAdvance.data.draftMode).toBe("real");
      expect(lockedAdvance.data.draftNightLock).toMatchObject({ locked: true });
      expect(lockedAdvance.data.session.commandCount).toBe(1);
      expect(lockedAdvance.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
      expect(lockedAdvance.data.errors[0]?.message).toContain("Live session is locked for mock draft advances");

      const liveState = await fetch(`${baseUrl}/api/state?draftSession=live&mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(liveState.draftMode).toBe("real");
      expect(liveState.draftNightLock).toMatchObject({ locked: true });
      expect(liveState.session.commandCount).toBe(1);
      expect(liveState.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
