import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerRequestRoutingTests = (): void => {
  it("uses the larger configured body limit only for draft imports", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        importMaxBodyBytes: 256,
        sessionDirectory: directory,
        interactiveMockDraft,
        maxBodyBytes: 32,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);
      const body = { content: "x".repeat(48), format: "csv" };

      expect((await post(baseUrl, "/api/events", body)).status).toBe(413);
      expect((await post(baseUrl, "/api/import", body)).status).not.toBe(413);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects obsolete browser routes while keeping draft APIs available", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      for (const path of ["/", "/draft-room", "/mock-results", "/mock-simulations", "/my-expert", "/player-news"]) {
        const response = await fetch(`${baseUrl}${path}`);
        expect(response.status).toBe(410);
        expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
        expect(await response.json()).toEqual({
          error: {
            code: "frontend_removed",
            message: "This server provides draft APIs only. Use the Mockd React application.",
          },
        });
      }

      expect((await fetch(`${baseUrl}/api/state`)).status).toBe(200);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
