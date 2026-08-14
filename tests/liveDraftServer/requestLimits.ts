import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { collectJsonResponse, createLiveDraftServer, httpRequest, listen, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerRequestLimitTests = (): void => {
  it("rejects disabled legacy mock batches before reading or allocating work", async () => {
    const directory = await tempSessionDirectory();
    try {
      let runnerCalls = 0;
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        legacyMockBatchEnabled: false,
        mockBatchRunner: options => {
          runnerCalls += 1;
          return mockBatchRunner(options);
        },
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const response = await fetch(`${baseUrl}/api/mock-batch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "legacy_mock_batch_disabled",
          message: "Legacy mock batch jobs are disabled.",
        },
      });
      expect(runnerCalls).toBe(0);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects a declared oversized API body without waiting for the body", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        maxBodyBytes: 32,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);
      const request = httpRequest(`${baseUrl}/api/events`, {
        method: "POST",
        headers: {
          "content-length": "1000",
          "content-type": "application/json",
        },
      });
      const responsePromise = collectJsonResponse(request);
      request.flushHeaders();

      const response = await new Promise<{ status: number; data: unknown }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          request.destroy();
          reject(new Error("Server waited for the oversized body."));
        }, 250);
        responsePromise.then(result => {
          clearTimeout(timeout);
          resolve(result);
        }, error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      expect(response).toEqual({
        status: 413,
        data: {
          error: {
            code: "request_body_too_large",
            message: "Request body exceeds the configured size limit.",
          },
        },
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects chunked API bodies as soon as the streamed bytes exceed the limit", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        maxBodyBytes: 32,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);
      const request = httpRequest(`${baseUrl}/api/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const responsePromise = collectJsonResponse(request);

      request.write('{"command":"');
      request.write("x".repeat(32));

      expect(await responsePromise).toEqual({
        status: 413,
        data: {
          error: {
            code: "request_body_too_large",
            message: "Request body exceeds the configured size limit.",
          },
        },
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
