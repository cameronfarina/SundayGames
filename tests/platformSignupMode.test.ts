import { describe, expect, it } from "vitest";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import { CapturingAuthMailSender } from "../src/platform/auth.js";
import { createPlatformApp, InMemoryPlatformStore } from "../src/platform/platformApp.js";
import { createPlatformHttpHandler } from "../src/platform/platformHttp.js";
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";

const now = new Date("2026-08-13T12:00:00.000Z");
const mockRunner: SimulationMockBatchRunner = options => ({
  options: {
    forcedSales: [...options.forcedSales],
    runsPerScenario: options.runsPerScenario,
    scenarioKeys: ["expected"],
    seedPrefix: options.seedPrefix,
  },
  runs: [],
  summary: {
    ownerPlayerExposure: [],
    owners: [],
    players: [],
    runCount: options.runsPerScenario,
    scenarios: [],
  },
}) satisfies MockBatch;

describe("platform signup mode", () => {
  it("requires a password for immediate local signup", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    await expect(handle({ method: "GET", path: "/accounts" })).resolves.toEqual({
      status: 200,
      body: { passwordRequired: true },
    });
    await expect(handle({
      method: "POST",
      path: "/accounts",
      body: { email: "local@example.com" },
      now,
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "invalid_password", message: "Password is required." } },
    });
  });

  it("accepts email-only signup when mailbox verification establishes the password", async () => {
    const mailSender = new CapturingAuthMailSender();
    const app = createPlatformApp({
      authEmail: {
        mailSender,
        publicBaseUrl: "https://mockd.example.com",
        verificationRequired: true,
      },
      store: new InMemoryPlatformStore(),
      simulationRunner: mockRunner,
    });
    const handle = createPlatformHttpHandler(app, { emailVerificationRequired: true });

    await expect(handle({ method: "GET", path: "/accounts" })).resolves.toEqual({
      status: 200,
      body: { passwordRequired: false },
    });
    await expect(handle({
      method: "POST",
      path: "/accounts",
      body: { email: "owner@example.com", returnTo: "/invite?token=league-invite" },
      now,
    })).resolves.toEqual({
      status: 202,
      body: {
        accepted: true,
        message: "If this email can be registered, a verification link is on its way.",
      },
    });
    expect(mailSender.messages[0]?.actionUrl).toContain("returnTo=%2Finvite%3Ftoken%3Dleague-invite");
  });
});
