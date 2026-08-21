import { describe, expect, it } from "vitest";
import { NodePostgresClient } from "../src/platform/postgresClient.js";
import { readPlatformRuntimeConfig } from "../src/platform/platformRuntimeConfig.js";
import { platformWebServerOptions } from "../src/platform/startPlatformWeb/serverOptions.js";
import { mockRunner } from "./platformServer/helpers/domainFixtures.js";

describe("platform web draft operations", () => {
  it("builds creator schedule and digest services from production configuration", () => {
    const config = readPlatformRuntimeConfig({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      MOCKD_LIVE_DRAFT_DATA_MODE: "postgres",
      MOCKD_PLATFORM_ADMIN_ACCOUNT_IDS: "creator-account",
      MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN:
        "digest-trigger-token-at-least-32-characters",
      MOCKD_PLATFORM_DRAFT_DIGEST_WEBHOOK_URL:
        "https://discord.com/api/webhooks/123/token",
    });
    const postgresClient = new NodePostgresClient({
      connect: async () => { throw new Error("No transaction expected."); },
      end: async () => undefined,
      query: async () => ({ rowCount: 0, rows: [] }),
    });

    const options = platformWebServerOptions(config, {
      authMailSender: undefined,
      postgresClient,
      screenshotAnalyzer: undefined,
      signupNotifier: undefined,
      simulationRunner: mockRunner,
      staticWebAssets: undefined,
    });

    expect(options.platformDraftOperations?.administratorAccountIds)
      .toEqual(new Set(["creator-account"]));
    expect(options.platformDraftOperations?.timezone).toBe("America/New_York");
    expect(options.platformDraftOperations?.digest).toBeDefined();
  });
});
