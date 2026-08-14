import { expect, it } from "vitest";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { interactiveMockDraft, mockSaleCommand, realSaleCommand } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, createRuntimeLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerSessionTests = (): void => {
  it("keeps named live, practice, and scratch sessions in separate file stores", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const liveSale = await post(baseUrl, "/api/events", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      const practiceSale = await post(baseUrl, "/api/events", {
        draftSession: "practice-3rb",
        mode: "real",
        strategyKey: "three-rb",
        command: mockSaleCommand,
      });
      const scratchSale = await post(baseUrl, "/api/events", {
        draftSession: "scratch:late-room",
        mode: "real",
        strategyKey: "three-rb",
        command: "Owner04 drafted Derrick Henry for 62",
      });

      expect(liveSale.status).toBe(200);
      expect(practiceSale.status).toBe(200);
      expect(scratchSale.status).toBe(200);

      const liveState = await fetch(`${baseUrl}/api/state?draftSession=live&mode=real`)
        .then(response => response.json());
      const practiceState = await fetch(`${baseUrl}/api/state?draftSession=practice-3rb&mode=real`)
        .then(response => response.json());
      const emptyPracticeState = await fetch(`${baseUrl}/api/state?draftSession=practice-wr-heavy&mode=real`)
        .then(response => response.json());
      const scratchState = await fetch(`${baseUrl}/api/state?draftSession=scratch:late-room&mode=real`)
        .then(response => response.json());

      expect(liveState.activeDraftSession).toMatchObject({ key: "live", label: "Live" });
      expect(liveState.draftSessions.map((session: { key: string }) => session.key)).toEqual(
        expect.arrayContaining(["live", "practice-3rb", "practice-wr-heavy"]),
      );
      expect(liveState.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
      expect(liveState.session.paths.directory).toBe(directory);

      expect(practiceState.activeDraftSession).toMatchObject({ key: "practice-3rb", label: "Practice 3RB" });
      expect(practiceState.events.map((event: { input: string }) => event.input)).toEqual([mockSaleCommand]);
      expect(practiceState.session.paths.directory).toBe(join(directory, "practice-3rb"));

      expect(emptyPracticeState.events).toHaveLength(0);
      expect(emptyPracticeState.session.paths.directory).toBe(join(directory, "practice-wr-heavy"));

      expect(scratchState.activeDraftSession).toMatchObject({ key: "scratch:late-room", label: "Scratch: late-room" });
      expect(scratchState.events.map((event: { input: string }) => event.input)).toEqual([
        "Owner04 drafted Derrick Henry for 62",
      ]);
      expect(scratchState.session.paths.directory).toBe(join(directory, "scratch", "late-room"));

      const practiceMock = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "named-session-test",
        action: "advance",
      });
      expect(practiceMock.status).toBe(200);
      expect(practiceMock.data.session.paths.directory).toBe(join(directory, "practice-3rb", "interactive-mock"));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects unique scratch sessions before allocating production resources", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createRuntimeLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);
      const filesBefore = await readdir(directory, { recursive: true });

      for (let index = 0; index < 25; index += 1) {
        const draftSession = `scratch:production-probe-${index}`;
        const response = index % 2 === 0
          ? await fetch(`${baseUrl}/api/state?draftSession=${encodeURIComponent(draftSession)}&mode=real`)
          : await fetch(`${baseUrl}/api/events`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              draftSession,
              mode: "real",
              strategyKey: "three-rb",
              command: "Owner04 drafted Derrick Henry for 62",
            }),
          });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
          error: {
            code: "scratch_sessions_disabled",
            message: "Scratch draft sessions are not available.",
          },
        });
      }

      expect(await readdir(directory, { recursive: true })).toEqual(filesBefore);

      const liveState = await fetch(`${baseUrl}/api/state?draftSession=live&mode=real`);
      const practiceState = await fetch(
        `${baseUrl}/api/state?draftSession=practice-3rb&mode=interactive-mock`,
      );
      expect(liveState.status).toBe(200);
      expect(practiceState.status).toBe(200);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
