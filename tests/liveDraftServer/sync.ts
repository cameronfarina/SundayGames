import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, restoreSyncEnv, servers, snapshotSyncEnv, syncEnvKeys, tempSessionDirectory } from "./support/serverHarness.js";

export const registerSyncTests = (): void => {
  it("serves read-only league sync provider readiness and setup-gated Yahoo OAuth", async () => {
    const directory = await tempSessionDirectory();
    let sleeperDirectory: string | undefined;
    const envSnapshot = snapshotSyncEnv();
    try {
      for (const key of syncEnvKeys) delete process.env[key];

      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const providersResponse = await fetch(`${baseUrl}/api/sync/providers`);
      expect(providersResponse.status).toBe(200);
      const providersData = await providersResponse.json();
      expect(providersData.policy).toEqual(expect.objectContaining({
        mode: "read-only",
        blockedActions: expect.arrayContaining(["add", "drop", "trade", "set-lineup"]),
      }));
      expect(providersData.providers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: "sleeper",
          status: "available",
          auth: expect.objectContaining({ type: "none", configured: true }),
        }),
        expect.objectContaining({
          key: "yahoo",
          status: "setup-required",
          auth: expect.objectContaining({ type: "oauth2", configured: false }),
        }),
      ]));

      const yahooStartResponse = await fetch(`${baseUrl}/api/sync/oauth/yahoo/start`);
      expect(yahooStartResponse.status).toBe(501);
      const yahooStartData = await yahooStartResponse.json();
      expect(yahooStartData).toEqual(expect.objectContaining({
        provider: "yahoo",
        error: expect.stringMatching(/MOCKD_YAHOO_CLIENT_ID/i),
        requiredEnv: expect.arrayContaining(["MOCKD_YAHOO_CLIENT_ID", "MOCKD_YAHOO_CLIENT_SECRET"]),
      }));
      expect(yahooStartData.setupSteps).toEqual(expect.arrayContaining([expect.stringMatching(/Yahoo Developer/i)]));

      process.env.MOCKD_YAHOO_CLIENT_ID = "test-client-id";
      process.env.MOCKD_YAHOO_CLIENT_SECRET = "test-client-secret";
      const readyYahooStartResponse = await fetch(`${baseUrl}/api/sync/oauth/yahoo/start`);
      expect(readyYahooStartResponse.status).toBe(200);
      const readyYahooStartData = await readyYahooStartResponse.json();
      expect(readyYahooStartData).toEqual(expect.objectContaining({
        provider: "yahoo",
        readOnly: true,
        redirectUri: `${baseUrl}/api/sync/oauth/yahoo/callback`,
        scope: "fspt-r",
        state: expect.any(String),
      }));
      expect(readyYahooStartData.authorizationUrl).toContain("https://api.login.yahoo.com/oauth2/request_auth");
      expect(readyYahooStartData.authorizationUrl).toContain("client_id=test-client-id");
      expect(readyYahooStartData.authorizationUrl).toContain("response_type=code");

      const callbackResponse = await fetch(
        `${baseUrl}/api/sync/oauth/yahoo/callback?code=test-code&state=${readyYahooStartData.state}`,
      );
      expect(callbackResponse.status).toBe(200);
      const callbackData = await callbackResponse.json();
      expect(callbackData).toEqual(expect.objectContaining({
        provider: "yahoo",
        readOnly: true,
        status: "authorization-code-received",
        tokenEndpoint: "https://api.login.yahoo.com/oauth2/get_token",
      }));

      sleeperDirectory = await tempSessionDirectory();
      const sleeperApp = await createLiveDraftServer({
        sessionDirectory: sleeperDirectory,
        interactiveMockDraft,
        mockBatchRunner,
        sleeperSyncPreviewProvider: async ({ identifier, season }) => ({
          provider: "sleeper",
          readOnly: true,
          identifier,
          season,
          resolvedAs: "user",
          message: "Found 1 Sleeper league.",
          leagues: [{
            leagueId: "123",
            name: "Owner11 Sleeper League",
            status: "in_season",
            season,
            totalRosters: 12,
          }],
        }),
      });
      servers.push(sleeperApp.server);
      const sleeperBaseUrl = await listen(sleeperApp.server);
      const sleeperResponse = await fetch(`${sleeperBaseUrl}/api/sync/sleeper/preview?identifier=owner11&season=2026`);
      expect(sleeperResponse.status).toBe(200);
      await expect(sleeperResponse.json()).resolves.toEqual(expect.objectContaining({
        provider: "sleeper",
        readOnly: true,
        identifier: "owner11",
        season: "2026",
        message: "Found 1 Sleeper league.",
        leagues: [expect.objectContaining({ leagueId: "123", name: "Owner11 Sleeper League" })],
      }));
    } finally {
      restoreSyncEnv(envSnapshot);
      await rm(directory, { force: true, recursive: true });
      if (sleeperDirectory) await rm(sleeperDirectory, { force: true, recursive: true });
    }
  });

};
