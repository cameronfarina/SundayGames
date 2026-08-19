import { describe, expect, it } from "vitest";
import { readPlatformRuntimeConfig } from "../../src/platform/platformRuntimeConfig.js";

describe("platform runtime config parsing", () => {
  it("reads web, Postgres, and worker settings from environment variables", () => {
    const config = readPlatformRuntimeConfig({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      HOST: "0.0.0.0",
      PORT: "4361",
      MOCKD_POSTGRES_POOL_SIZE: "7",
      MOCKD_POSTGRES_STATEMENT_TIMEOUT_MS: "2500",
      MOCKD_POSTGRES_SNAPSHOT_KEY: "prod",
      MOCKD_INITIALIZE_POSTGRES_SCHEMA: "true",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
      MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
      MOCKD_TRUST_PROXY: "true",
      MOCKD_LIVE_DRAFT_DATA_MODE: "postgres",
      MOCKD_PROVISIONING_TOKEN: "production-provisioning-token",
      MOCKD_INVITATION_TOKEN_SECRET: "test-invitation-secret-at-least-32-characters",
      MOCKD_SIMULATION_DATA_MODE: "local-fixtures",
      MOCKD_SCREENSHOT_IMPORT_MODE: "openai",
      OPENAI_API_KEY: "test-openai-key",
      MOCKD_SCREENSHOT_IMPORT_MODEL: "gpt-5.6-terra",
      MOCKD_SCREENSHOT_IMPORT_TIMEOUT_MS: "20000",
      MOCKD_SCREENSHOT_IMPORT_MAX_IMAGE_BYTES: "4194304",
      MOCKD_SCREENSHOT_IMPORT_MAX_CONCURRENCY: "3",
      FANTASYPROS_API_KEY: "test-fantasypros-key",
      MOCKD_WORKER_ID: "worker-a",
      MOCKD_WORKER_JOB_KINDS: "simulation",
      MOCKD_WORKER_POLL_INTERVAL_MS: "750",
      MOCKD_WORKER_LOCK_TTL_MS: "45000",
    });

    expect(config).toEqual({
      host: "0.0.0.0",
      port: 4361,
      databaseUrl: "postgres://mockd:test@localhost:5432/mockd",
      dataFilePath: undefined,
      postgresPoolSize: 7,
      postgresStatementTimeoutMs: 2500,
      postgresSnapshotKey: "prod",
      initializePostgresSchema: true,
      draftToolsSessionDirectory: "/var/lib/mockd/draft-tools",
      legacyMockBatchEnabled: false,
      allowPublicSignup: true,
      trustProxy: true,
      liveDraftDataMode: "postgres",
      provisioningToken: "production-provisioning-token",
      invitationTokenSecret: "test-invitation-secret-at-least-32-characters",
      authEmail: {
        mode: "auto-verify",
        resendApiKey: undefined,
        from: undefined,
        publicBaseUrl: undefined,
      },
      simulationDataMode: "local-fixtures",
      screenshotImport: {
        mode: "openai",
        apiKey: "test-openai-key",
        model: "gpt-5.6-terra",
        timeoutMs: 20000,
        maxImageBytes: 4194304,
        maxConcurrentRequests: 3,
      },
      fantasyPros: {
        apiKey: "test-fantasypros-key",
        refreshEnabled: true,
        season: 2026,
      },
      playerNews: { refreshEnabled: true },
      worker: {
        workerId: "worker-a",
        jobKinds: ["simulation"],
        pollIntervalMs: 750,
        lockTtlMs: 45000,
      },
    });
  });

  it("supports explicit local file storage when database config is absent", () => {
    const config = readPlatformRuntimeConfig({
      MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
      MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
    });

    expect(config.databaseUrl).toBeUndefined();
    expect(config.dataFilePath).toBe("/tmp/mockd-platform.json");
    expect(config.draftToolsSessionDirectory).toBe("data/platform-draft-tools");
    expect(config.legacyMockBatchEnabled).toBe(false);
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(0);
    expect(config.liveDraftDataMode).toBe("local-fixtures");
    expect(config.allowPublicSignup).toBe(false);
    expect(config.trustProxy).toBe(false);
    expect(config.provisioningToken).toBeUndefined();
    expect(config.simulationDataMode).toBe("disabled");
    expect(config.screenshotImport).toEqual({
      mode: "disabled",
      apiKey: undefined,
      model: "gpt-5.6-terra",
      timeoutMs: 30000,
      maxImageBytes: 5242880,
      maxConcurrentRequests: 2,
    });
    expect(config.fantasyPros).toEqual({
      apiKey: undefined,
      refreshEnabled: false,
      season: 2026,
    });
    // RotoWire needs no key, so news refreshes unless it is switched off.
    expect(config.playerNews).toEqual({ refreshEnabled: true });
    expect(config.worker.workerId).toMatch(/^worker_/);
    expect(config.worker.jobKinds).toEqual(["simulation"]);
  });

  it("switches the news refresh off for an offline run", () => {
    // The end-to-end run blanks every credential, but RotoWire needs none, so
    // only this switch keeps the run from reaching a public feed.
    const config = readPlatformRuntimeConfig({
      MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
      MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
      MOCKD_PLAYER_NEWS_REFRESH_ENABLED: "false",
    });

    expect(config.playerNews).toEqual({ refreshEnabled: false });
  });
});
