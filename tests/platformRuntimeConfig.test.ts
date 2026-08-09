import { describe, expect, it } from "vitest";
import { readPlatformRuntimeConfig } from "../src/platform/platformRuntimeConfig.js";

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
});
