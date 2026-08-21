import { describe, expect, it, vi } from "vitest";
import type { AccountDashboardRepository } from "../src/platform/accountDashboard.js";
import { createPlatformHttpHandler } from "../src/platform/platformHttp.js";
import { createPlatformApp, InMemoryPlatformStore } from "../src/platform/platformApp.js";

describe("account dashboard handler wiring", () => {
  it("dispatches the authenticated account dashboard route", async () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: () => { throw new Error("Simulation is not used by this test."); },
    });
    const password = "account dashboard 1!";
    await app.createAccount({ email: "member@example.com", password, now });
    const login = await app.login({ email: "member@example.com", password, now });
    if (login === null) throw new Error("Expected login fixture.");
    const repository: AccountDashboardRepository = {
      listForAccount: vi.fn().mockResolvedValue([]),
    };
    const handler = createPlatformHttpHandler(app, { accountDashboardRepository: repository });

    const response = await handler({
      method: "GET",
      now,
      path: "/account-dashboard",
      sessionToken: login.sessionToken,
    });

    expect(response).toEqual({ status: 200, body: { leagues: [] } });
    expect(repository.listForAccount).toHaveBeenCalledOnce();
  });
});
