import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft, realSaleCommand } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerTransferTests = (): void => {
  it("exports a complete one-click draft session bundle", async () => {
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
        draftSession: "practice-wr-heavy",
        mode: "real",
        strategyKey: "wr-heavy",
        command: realSaleCommand,
      });
      expect(sale.status).toBe(200);

      const response = await fetch(`${baseUrl}/api/export-bundle?draftSession=practice-wr-heavy&mode=real&strategy=wr-heavy`);
      expect(response.status).toBe(200);
      const bundle = await response.json();
      expect(bundle.version).toBe(1);
      expect(bundle.activeDraftSession).toMatchObject({ key: "practice-wr-heavy", label: "Practice WR Heavy" });
      expect(bundle.draftMode).toBe("real");
      expect(bundle.session.commandCount).toBe(1);
      expect(bundle.readiness.status).toMatch(/pass|warn/);
      expect(bundle.currentSnapshot.commands).toEqual([realSaleCommand]);
      expect(bundle.backupSnapshot.commands).toEqual([realSaleCommand]);
      expect(bundle.commandsJson).toContain(realSaleCommand);
      expect(bundle.commandsCsv).toContain("index,command");
      expect(bundle.commandsCsv).toContain(realSaleCommand);
      expect(bundle.auditLogJsonl).toContain(realSaleCommand);

      const reset = await post(baseUrl, "/api/reset", {
        draftSession: "practice-wr-heavy",
        mode: "real",
        strategyKey: "wr-heavy",
      });
      expect(reset.status).toBe(200);
      expect(reset.data.session.commandCount).toBe(0);

      const imported = await post(baseUrl, "/api/import", {
        draftSession: "practice-wr-heavy",
        mode: "real",
        strategyKey: "wr-heavy",
        format: "json",
        content: JSON.stringify(bundle),
      });
      expect(imported.status).toBe(200);
      expect(imported.data.session.commandCount).toBe(1);
      expect(imported.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("returns a compact import conflict review without replacing the session", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const rejected = await post(baseUrl, "/api/import", {
        draftSession: "practice-3rb",
        mode: "real",
        strategyKey: "three-rb",
        commands: [
          "owner11 drafted brown for 12",
          "nobody drafted Jahmyr Gibbs for 1",
        ],
      });

      expect(rejected.status).toBe(422);
      expect(rejected.data.session.commandCount).toBe(0);
      expect(rejected.data.events).toHaveLength(0);
      expect(rejected.data.conflictReview).toMatchObject({
        title: "Import needs review",
        importedCount: 2,
        issueCount: 2,
      });
      expect(rejected.data.conflictReview.issues).toEqual([
        expect.objectContaining({
          index: 1,
          type: "ambiguous-player",
          input: "owner11 drafted brown for 12",
          matchOptions: expect.arrayContaining(["A.J. Brown", "Chase Brown"]),
        }),
        expect.objectContaining({
          index: 2,
          type: "invalid-command",
          input: "nobody drafted Jahmyr Gibbs for 1",
          matchOptions: [],
        }),
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
