import { InMemoryPlatformStore, createClientAddressRateLimiter, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, vi } from "../support/index.js";
import type { EspnLeagueSettingsImportOutcome, LeagueMembersScreenshotAnalyzer } from "../support/index.js";

describe("platform HTTP contract", () => {
it("reviews ESPN league settings for a signed-in commissioner before creating anything", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const outcome: EspnLeagueSettingsImportOutcome = {
      kind: "manual-review-required",
      provider: "espn",
      confirmationRequired: true,
      reason: "private_or_unauthorized",
      externalLeagueId: "100001",
      season: 2026,
      confirmationMethods: ["screenshot", "manual"],
      message: "This ESPN league is private. Confirm its settings from screenshots or enter them manually.",
    };
    const espnLeagueSettingsImporter = vi.fn(async () => outcome);
    const handle = createPlatformHttpHandler(app, {
      espnLeagueSettingsImporter,
      leagueImportRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 10,
      }),
    });
    const login = await createLoggedInAccount(handle, "espn-review@example.com");

    await expect(handle({
      method: "POST",
      path: "/league-imports/espn/review",
      body: { leagueIdOrUrl: "100001", season: 2026 },
    })).resolves.toMatchObject({ status: 401, body: { error: { code: "auth_required" } } });

    await expect(handle({
      method: "POST",
      path: "/league-imports/espn/review",
      sessionToken: login.sessionToken,
      body: { leagueIdOrUrl: "100001", season: 2026 },
    })).resolves.toEqual({ status: 200, body: outcome });
    await expect(handle({
      method: "POST",
      path: "/league-imports/espn/review",
      sessionToken: login.sessionToken,
      body: { leagueIdOrUrl: "100001", season: 2026 },
    })).resolves.toMatchObject({
      status: 429,
      body: { error: { code: "rate_limited" } },
      headers: { "Retry-After": "60" },
    });
    expect(espnLeagueSettingsImporter).toHaveBeenCalledWith({ leagueIdOrUrl: "100001", season: 2026 });
    expect(espnLeagueSettingsImporter).toHaveBeenCalledTimes(1);
  });

it("extracts team and manager identities before a private ESPN league is created", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const analyzeScreenshot: LeagueMembersScreenshotAnalyzer["analyze"] = async () => ({
        leagueName: "The Sunday Games",
        externalLeagueId: "100001",
        teams: [{
          draftOrderPosition: 1,
          abbreviation: "Mack",
          teamDisplayName: "Short King",
          managerDisplayNames: ["Owner11 Manager"],
          confidence: "high",
          issues: [],
          confirmed: false,
        }],
      });
    const leagueMembersScreenshotAnalyzer = {
      analyze: vi.fn(analyzeScreenshot),
    };
    const handle = createPlatformHttpHandler(app, { leagueMembersScreenshotAnalyzer });
    const login = await createLoggedInAccount(handle, "private-espn@example.com");

    const response = await handle({
      method: "POST",
      path: "/league-imports/espn/members-screenshot-review",
      sessionToken: login.sessionToken,
      body: { mimeType: "image/png", base64: "encoded-image" },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        import: {
          leagueName: "The Sunday Games",
          externalLeagueId: "100001",
          teams: [expect.objectContaining({
            teamDisplayName: "Short King",
            managerDisplayNames: ["Owner11 Manager"],
          })],
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/email|status|invite/i);
  });

it("reports whether pre-creation screenshot analysis is available", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const unavailableHandle = createPlatformHttpHandler(app);
    const unavailableLogin = await createLoggedInAccount(unavailableHandle, "screenshot-unavailable@example.com");

    await expect(unavailableHandle({
      method: "GET",
      path: "/league-imports/espn/members-screenshot-review",
    })).resolves.toMatchObject({ status: 401 });
    await expect(unavailableHandle({
      method: "GET",
      path: "/league-imports/espn/members-screenshot-review",
      sessionToken: unavailableLogin.sessionToken,
    })).resolves.toEqual({ status: 200, body: { available: false } });

    const availableHandle = createPlatformHttpHandler(app, {
      leagueMembersScreenshotAnalyzer: { analyze: vi.fn() },
    });
    await expect(availableHandle({
      method: "GET",
      path: "/league-imports/espn/members-screenshot-review",
      sessionToken: unavailableLogin.sessionToken,
    })).resolves.toEqual({ status: 200, body: { available: true } });
  });
});
