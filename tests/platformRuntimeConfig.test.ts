import { describe, expect, it } from "vitest";
import {
  assessPlatformProductionReadiness,
  formatPlatformProductionReadinessReport,
  platformProductionReadinessExitCode,
  readPlatformRuntimeConfig,
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
      MOCKD_SIMULATION_DATA_MODE: "local-fixtures",
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
      simulationDataMode: "local-fixtures",
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
    });

    expect(config.databaseUrl).toBeUndefined();
    expect(config.dataFilePath).toBe("/tmp/mockd-platform.json");
    expect(config.draftToolsSessionDirectory).toBe("data/platform-draft-tools");
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(0);
    expect(config.simulationDataMode).toBe("disabled");
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

  it("reports production/domain readiness for a Postgres-backed deploy target", () => {
    const report = assessPlatformProductionReadiness({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      HOST: "0.0.0.0",
      PORT: "443",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
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
        label: "Private draft storage",
        detail: "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY is configured.",
      },
      {
        status: "pass",
        label: "Web bind target",
        detail: "Host 0.0.0.0, port 443.",
      },
    ]);
    expect(report.nextSteps.join("\n")).toContain("npm run platform:migrate");
    expect(report.nextSteps.join("\n")).toContain("persistent volume");
    expect(report.nextSteps.join("\n")).toContain("Seed or verify");
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
