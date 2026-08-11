import { describe, expect, it } from "vitest";
import {
  assessPlatformProductionReadiness,
  formatPlatformProductionReadinessReport,
  platformProductionReadinessExitCode,
  readPlatformRuntimeConfig,
  readPlatformWebRuntimeConfig,
} from "../src/platform/platformRuntimeConfig.js";

describe("platform runtime config", () => {
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
      MOCKD_SIMULATION_DATA_MODE: "local-fixtures",
      MOCKD_SCREENSHOT_IMPORT_MODE: "openai",
      OPENAI_API_KEY: "test-openai-key",
      MOCKD_SCREENSHOT_IMPORT_MODEL: "gpt-5.6-terra",
      MOCKD_SCREENSHOT_IMPORT_TIMEOUT_MS: "20000",
      MOCKD_SCREENSHOT_IMPORT_MAX_IMAGE_BYTES: "4194304",
      MOCKD_SCREENSHOT_IMPORT_MAX_CONCURRENCY: "3",
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
      allowPublicSignup: true,
      trustProxy: true,
      liveDraftDataMode: "postgres",
      provisioningToken: "production-provisioning-token",
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
    expect(config.worker.workerId).toMatch(/^worker_/);
    expect(config.worker.jobKinds).toEqual(["simulation"]);
  });

  it("rejects ambiguous storage configuration and invalid numeric values", () => {
    expect(() =>
      readPlatformRuntimeConfig({
        DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
        MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
      }),
    ).toThrow("Configure either DATABASE_URL or MOCKD_PLATFORM_DATA_FILE, not both.");

    expect(() =>
      readPlatformRuntimeConfig({
        DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
        MOCKD_WORKER_POLL_INTERVAL_MS: "0",
      }),
    ).toThrow("MOCKD_WORKER_POLL_INTERVAL_MS must be a positive integer.");

    expect(() =>
      readPlatformRuntimeConfig({
        MOCKD_SIMULATION_DATA_MODE: "current-league",
      }),
    ).toThrow("MOCKD_SIMULATION_DATA_MODE must be disabled or local-fixtures.");

    expect(() =>
      readPlatformRuntimeConfig({
        MOCKD_WORKER_JOB_KINDS: "simulation,export",
      }),
    ).toThrow("MOCKD_WORKER_JOB_KINDS contains unsupported launch job kind \"export\".");

    expect(() =>
      readPlatformRuntimeConfig({
        MOCKD_TRUST_PROXY: "sometimes",
      }),
    ).toThrow("MOCKD_TRUST_PROXY must be true or false.");

    expect(() => readPlatformRuntimeConfig({
      MOCKD_SCREENSHOT_IMPORT_MODE: "openai",
    })).toThrow("OPENAI_API_KEY is required when screenshot import mode is openai.");
  });

  it("can require Postgres for production entrypoints", () => {
    expect(() =>
      readPlatformRuntimeConfig({}, { requireDatabase: true }),
    ).toThrow("DATABASE_URL is required.");
  });

  it("rejects simulation workers when simulation data is disabled", () => {
    expect(() =>
      readPlatformRuntimeConfig({
        DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      }, {
        requireDatabase: true,
        requireRunnableWorker: true,
      }),
    ).toThrow("MOCKD_SIMULATION_DATA_MODE=local-fixtures is required when workers claim simulation jobs.");

    expect(readPlatformRuntimeConfig({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      MOCKD_SIMULATION_DATA_MODE: "local-fixtures",
    }, {
      requireDatabase: true,
      requireRunnableWorker: true,
    }).worker.jobKinds).toEqual(["simulation"]);
  });

  it("can require any durable store for the production web entrypoint", () => {
    expect(() =>
      readPlatformRuntimeConfig({}, { requireDurableStore: true }),
    ).toThrow("DATABASE_URL or MOCKD_PLATFORM_DATA_FILE is required.");

    expect(readPlatformRuntimeConfig({
      MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
    }, { requireDurableStore: true }).dataFilePath).toBe("/tmp/mockd-platform.json");
  });

  it("rejects local live-draft fixtures in production", () => {
    expect(() =>
      readPlatformRuntimeConfig({
        NODE_ENV: "production",
        MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
        MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
      }),
    ).toThrow("MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is only supported outside production.");
  });

  it("requires explicit shared storage settings for the default web mode", () => {
    expect(() =>
      readPlatformWebRuntimeConfig({
        DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      }),
    ).toThrow(
      "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY is required for Postgres-backed web startup.",
    );

    expect(() =>
      readPlatformWebRuntimeConfig({
        DATABASE_URL: "file:/tmp/mockd-platform.json",
        MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
      }),
    ).toThrow("DATABASE_URL must be a postgres:// or postgresql:// connection string.");
  });

  it("requires production email verification delivery and an HTTPS public origin", () => {
    const base = {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
    };
    expect(() => readPlatformWebRuntimeConfig(base)).toThrow(
      "MOCKD_AUTH_EMAIL_MODE=resend is required in production.",
    );
    expect(() => readPlatformWebRuntimeConfig({
      ...base,
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "secret",
      MOCKD_EMAIL_FROM: "accounts@mockd.example.com",
      MOCKD_PUBLIC_BASE_URL: "http://mockd.example.com/path",
    })).toThrow("MOCKD_PUBLIC_BASE_URL must be a valid HTTPS origin.");
    expect(readPlatformWebRuntimeConfig({
      ...base,
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "secret",
      MOCKD_EMAIL_FROM: "accounts@mockd.example.com",
      MOCKD_PUBLIC_BASE_URL: "https://mockd.example.com",
    }).authEmail.mode).toBe("resend");
  });

  it("reports production/domain readiness for a Postgres-backed deploy target", () => {
    const report = assessPlatformProductionReadiness({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      HOST: "0.0.0.0",
      PORT: "443",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
      MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
      MOCKD_SCREENSHOT_IMPORT_MODE: "openai",
      OPENAI_API_KEY: "production-openai-key",
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "production-resend-key",
      MOCKD_EMAIL_FROM: "Mockd <accounts@mockd.example.com>",
      MOCKD_PUBLIC_BASE_URL: "https://mockd.example.com",
    });

    expect(report).toMatchObject({
      ready: true,
      host: "0.0.0.0",
      port: 443,
      storage: {
        kind: "postgres",
        envKey: "DATABASE_URL",
      },
    });
    expect(report.checks).toEqual([
      {
        status: "pass",
        label: "Postgres durable storage",
        detail: "DATABASE_URL is configured for durable platform storage.",
      },
      {
        status: "pass",
        label: "File-backed storage",
        detail: "MOCKD_PLATFORM_DATA_FILE is not configured.",
      },
      {
        status: "pass",
        label: "Account creation",
        detail: "Public account creation is enabled; league access still requires membership or an invitation.",
      },
      {
        status: "pass",
        label: "Account email delivery",
        detail: "Resend delivery, sender identity, and the public HTTPS origin are configured.",
      },
      {
        status: "pass",
        label: "Live draft data",
        detail: "Live draft data is configured for Postgres.",
      },
      {
        status: "pass",
        label: "Private draft storage",
        detail: "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY is configured.",
      },
      {
        status: "pass",
        label: "Web bind target",
        detail: "Host 0.0.0.0, port 443.",
      },
      {
        status: "pass",
        label: "Screenshot import",
        detail: "OpenAI screenshot analysis is configured.",
      },
    ]);
    expect(report.nextSteps.join("\n")).toContain("npm run platform:migrate");
    expect(report.nextSteps.join("\n")).toContain("persistent volume");
    expect(report.nextSteps.join("\n")).toContain("Create a commissioner account");
    expect(report.nextSteps.join("\n")).toContain("npm run smoke");
    expect(platformProductionReadinessExitCode(report)).toBe(0);

    const formatted = formatPlatformProductionReadinessReport(report);
    expect(formatted).toContain("Mockd production/domain readiness: READY");
    expect(formatted).toContain("Web bind: 0.0.0.0:443");
    expect(formatted).toContain("PASS Postgres durable storage - DATABASE_URL is configured");
  });

  it("blocks production/domain readiness when Postgres env is missing", () => {
    const report = assessPlatformProductionReadiness({
      HOST: "0.0.0.0",
      PORT: "4361",
    });

    expect(report.ready).toBe(false);
    expect(report.storage).toEqual({ kind: "missing" });
    expect(report.checks).toContainEqual({
      status: "fail",
      label: "Postgres durable storage",
      detail: "DATABASE_URL is required for production/domain readiness.",
    });
    expect(platformProductionReadinessExitCode(report)).toBe(1);
    expect(formatPlatformProductionReadinessReport(report)).toContain(
      "FAIL Postgres durable storage - DATABASE_URL is required for production/domain readiness.",
    );
  });

  it("blocks production/domain readiness when screenshot analysis is not configured", () => {
    const report = assessPlatformProductionReadiness({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      HOST: "0.0.0.0",
      PORT: "4361",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
    });

    expect(report.ready).toBe(false);
    expect(report.checks).toContainEqual({
      status: "fail",
      label: "Screenshot import",
      detail: "Set MOCKD_SCREENSHOT_IMPORT_MODE=openai and configure OPENAI_API_KEY.",
    });
  });

  it("blocks production/domain readiness when private draft storage is not configured", () => {
    const report = assessPlatformProductionReadiness({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      HOST: "0.0.0.0",
      PORT: "4361",
    });

    expect(report.ready).toBe(false);
    expect(report.checks).toContainEqual({
      status: "fail",
      label: "Private draft storage",
      detail: "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY must point to a persistent volume.",
    });
  });

  it("blocks local live-draft fixtures from production/domain readiness", () => {
    const report = assessPlatformProductionReadiness({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      HOST: "0.0.0.0",
      PORT: "4361",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
      MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
    });

    expect(report.ready).toBe(false);
    expect(report.checks).toContainEqual({
      status: "fail",
      label: "Live draft data",
      detail: "MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is local-only.",
    });
  });

  it("blocks file-backed stores for production/domain readiness", () => {
    const report = assessPlatformProductionReadiness({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
      HOST: "0.0.0.0",
      PORT: "4361",
    });

    expect(report.ready).toBe(false);
    expect(report.storage).toEqual({
      kind: "ambiguous",
      databaseEnvKey: "DATABASE_URL",
      dataFilePath: "/tmp/mockd-platform.json",
    });
    expect(report.checks).toContainEqual({
      status: "pass",
      label: "Postgres durable storage",
      detail: "DATABASE_URL is configured for durable platform storage.",
    });
    expect(report.checks).toContainEqual({
      status: "fail",
      label: "File-backed storage",
      detail: "MOCKD_PLATFORM_DATA_FILE is local-only and cannot be used for production/domain deployment.",
    });
    expect(platformProductionReadinessExitCode(report)).toBe(1);
  });

  it("blocks non-Postgres database URLs for production/domain readiness", () => {
    const report = assessPlatformProductionReadiness({
      DATABASE_URL: "file:/tmp/mockd-platform.json",
      HOST: "0.0.0.0",
      PORT: "4361",
    });

    expect(report.ready).toBe(false);
    expect(report.checks).toContainEqual({
      status: "fail",
      label: "Postgres durable storage",
      detail: "DATABASE_URL must be a postgres:// or postgresql:// connection string.",
    });
    expect(formatPlatformProductionReadinessReport(report)).not.toContain("file:/tmp/mockd-platform.json");
  });

  it("requires an explicit production bind port", () => {
    const report = assessPlatformProductionReadiness({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      HOST: "0.0.0.0",
    });

    expect(report.ready).toBe(false);
    expect(report.host).toBe("0.0.0.0");
    expect(report.port).toBeUndefined();
    expect(report.checks).toContainEqual({
      status: "fail",
      label: "Web bind target",
      detail: "PORT is required for production/domain readiness.",
    });
    expect(formatPlatformProductionReadinessReport(report)).toContain("Web bind: 0.0.0.0:<missing PORT>");
  });
});
