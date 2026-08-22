import { describe, expect, it, vi } from "vitest";
import { createPlatformHttpHandler } from "../src/platform/platformHttp.js";
import { createPlatformApp, InMemoryPlatformStore } from "../src/platform/platformApp.js";

describe("platform draft operations handler wiring", () => {
  it("dispatches the creator-only schedule route", async () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: () => { throw new Error("Simulation is not used by this test."); },
    });
    const password = "creator draft operations 1!";
    const account = await app.createAccount({ email: "creator@example.com", password, now });
    const login = await app.login({ email: "creator@example.com", password, now });
    if (login === null) throw new Error("Expected login fixture.");
    const listScheduledDrafts = vi.fn().mockResolvedValue([]);
    const handler = createPlatformHttpHandler(app, {
      platformDraftOperations: {
        administratorAccountIds: new Set([account.id]),
        repository: { listScheduledDrafts },
        timezone: "America/New_York",
      },
    });

    const response = await handler({
      method: "GET",
      now,
      path: "/api/platform-admin/drafts",
      sessionToken: login.sessionToken,
    });

    expect(response.status).toBe(200);
    expect(listScheduledDrafts).toHaveBeenCalledOnce();
  });
});
