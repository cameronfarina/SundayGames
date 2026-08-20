import { describe, expect, it } from "vitest";
import {
  readPlatformRuntimeConfig,
  readPlatformWebRuntimeConfig,
} from "../../src/platform/platformRuntimeConfig.js";

describe("platform runtime config validation", () => {
  it("rejects ambiguous storage configuration and invalid numeric values", () => {
    expect(() => readPlatformRuntimeConfig({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
    })).toThrow("Configure either DATABASE_URL or MOCKD_PLATFORM_DATA_FILE, not both.");
    expect(() => readPlatformRuntimeConfig({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      MOCKD_WORKER_POLL_INTERVAL_MS: "0",
    })).toThrow("MOCKD_WORKER_POLL_INTERVAL_MS must be a positive integer.");
    expect(() => readPlatformRuntimeConfig({
      MOCKD_SIMULATION_DATA_MODE: "current-league",
    })).toThrow("MOCKD_SIMULATION_DATA_MODE must be disabled or local-fixtures.");
    expect(() => readPlatformRuntimeConfig({
      MOCKD_WORKER_JOB_KINDS: "simulation,export",
    })).toThrow("MOCKD_WORKER_JOB_KINDS contains unsupported launch job kind \"export\".");
    expect(() => readPlatformRuntimeConfig({
      MOCKD_TRUST_PROXY: "sometimes",
    })).toThrow("MOCKD_TRUST_PROXY must be true or false.");
    expect(() => readPlatformRuntimeConfig({
      MOCKD_SCREENSHOT_IMPORT_MODE: "openai",
    })).toThrow("OPENAI_API_KEY is required when screenshot import mode is openai.");
  });

  it("requires an explicit non-production opt-in for legacy mock batches", () => {
    expect(readPlatformRuntimeConfig({
      MOCKD_ENABLE_LEGACY_MOCK_BATCH: "true",
    }).legacyMockBatchEnabled).toBe(true);
    expect(readPlatformRuntimeConfig({
      NODE_ENV: "production",
    }).legacyMockBatchEnabled).toBe(false);
    expect(() => readPlatformRuntimeConfig({
      NODE_ENV: "production",
      MOCKD_ENABLE_LEGACY_MOCK_BATCH: "true",
    })).toThrow("MOCKD_ENABLE_LEGACY_MOCK_BATCH cannot be enabled in production.");
  });

  it("keeps the versioned season job producer off for the compatibility deploy", () => {
    expect(readPlatformRuntimeConfig({ NODE_ENV: "production" })
      .seasonSimulationProducerEnabled).toBe(false);
    expect(readPlatformRuntimeConfig({
      NODE_ENV: "production",
      MOCKD_SEASON_SIMULATION_PRODUCER_ENABLED: "true",
    }).seasonSimulationProducerEnabled).toBe(true);
  });

  it("can require Postgres for production entrypoints", () => {
    expect(() => readPlatformRuntimeConfig({}, { requireDatabase: true }))
      .toThrow("DATABASE_URL is required.");
  });

  it("runs durable season simulation workers without local fixture data", () => {
    const config = readPlatformRuntimeConfig({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
    }, {
      requireDatabase: true,
    });
    expect(config.simulationDataMode).toBe("disabled");
    expect(config.worker.jobKinds).toEqual(["simulation"]);
  });

  it("can require any durable store for the production web entrypoint", () => {
    expect(() => readPlatformRuntimeConfig({}, { requireDurableStore: true }))
      .toThrow("DATABASE_URL or MOCKD_PLATFORM_DATA_FILE is required.");
    expect(readPlatformRuntimeConfig({
      MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
    }, { requireDurableStore: true }).dataFilePath).toBe("/tmp/mockd-platform.json");
  });

  it("rejects local live-draft fixtures in production", () => {
    expect(() => readPlatformRuntimeConfig({
      NODE_ENV: "production",
      MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
      MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
    })).toThrow("MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is only supported outside production.");
  });

  it("rejects launch capacity below the production live-draft target", () => {
    expect(() => readPlatformWebRuntimeConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "production-resend-key",
      MOCKD_EMAIL_FROM: "Sunday Games <accounts@sundaygames.example.com>",
      MOCKD_PUBLIC_BASE_URL: "https://sundaygames.example.com",
      MOCKD_INVITATION_TOKEN_SECRET: "test-invitation-secret-at-least-32-characters",
      MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID: "credentials-v1",
      MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS: JSON.stringify({
        "credentials-v1": Buffer.alloc(32, 12).toString("base64"),
      }),
      MOCKD_LIVE_DRAFT_EVENT_STREAM_MAX_CONNECTIONS: "600",
    })).toThrow(
      "MOCKD_LIVE_DRAFT_EVENT_STREAM_MAX_CONNECTIONS must be at least 650 in production.",
    );
  });

  it("validates the credential keyring without echoing its secret values", () => {
    const secretValue = "do-not-echo-this-key";
    let thrown: unknown;
    try {
      readPlatformRuntimeConfig({
        MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID: "credentials-v1",
        MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS: JSON.stringify({
          "credentials-v1": secretValue,
        }),
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown)).toContain("canonical base64-encoded 32-byte key");
    expect(String(thrown)).not.toContain(secretValue);
  });
});
