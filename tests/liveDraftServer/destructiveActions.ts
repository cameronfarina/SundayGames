import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft, mockSaleCommand, realSaleCommand } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerDestructiveActionTests = (): void => {
  it("protects the live room from unconfirmed or stale undo, reset, and import actions", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const sale = await post(baseUrl, "/api/events", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      expect(sale.status).toBe(200);
      expect(sale.data.session.commandCount).toBe(1);

      const unconfirmedReset = await post(baseUrl, "/api/reset", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
      });
      expect(unconfirmedReset.status).toBe(409);
      expect(unconfirmedReset.data.session.commandCount).toBe(1);
      expect(unconfirmedReset.data.errors[0]?.message).toContain("requires confirmation");

      const staleReset = await post(baseUrl, "/api/reset", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmReset: true,
        expectedCommandCount: 0,
      });
      expect(staleReset.status).toBe(409);
      expect(staleReset.data.session.commandCount).toBe(1);
      expect(staleReset.data.errors[0]?.message).toContain("currently has 1");

      const unconfirmedUndo = await post(baseUrl, "/api/undo", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
      });
      expect(unconfirmedUndo.status).toBe(409);
      expect(unconfirmedUndo.data.session.commandCount).toBe(1);
      expect(unconfirmedUndo.data.errors[0]?.message).toContain("requires confirmation");

      const staleUndo = await post(baseUrl, "/api/undo", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmUndo: true,
        expectedCommandCount: 0,
      });
      expect(staleUndo.status).toBe(409);
      expect(staleUndo.data.session.commandCount).toBe(1);
      expect(staleUndo.data.errors[0]?.message).toContain("currently has 1");

      const unconfirmedImport = await post(baseUrl, "/api/import", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        expectedCommandCount: 1,
        commands: [mockSaleCommand],
      });
      expect(unconfirmedImport.status).toBe(409);
      expect(unconfirmedImport.data.session.commandCount).toBe(1);
      expect(unconfirmedImport.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const staleImport = await post(baseUrl, "/api/import", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmImport: true,
        expectedCommandCount: 0,
        commands: [mockSaleCommand],
      });
      expect(staleImport.status).toBe(409);
      expect(staleImport.data.session.commandCount).toBe(1);
      expect(staleImport.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const confirmedImport = await post(baseUrl, "/api/import", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmImport: true,
        expectedCommandCount: 1,
        commands: [mockSaleCommand],
      });
      expect(confirmedImport.status).toBe(200);
      expect(confirmedImport.data.session.commandCount).toBe(1);
      expect(confirmedImport.data.events.map((event: { input: string }) => event.input)).toEqual([mockSaleCommand]);

      const confirmedUndo = await post(baseUrl, "/api/undo", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmUndo: true,
        expectedCommandCount: 1,
      });
      expect(confirmedUndo.status).toBe(200);
      expect(confirmedUndo.data.session.commandCount).toBe(0);
      expect(confirmedUndo.data.events).toEqual([]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
