import { describe, expect, it } from "vitest";
import {
  assessPlatformProductionReadiness,
  formatPlatformProductionReadinessReport,
  platformProductionReadinessExitCode,
} from "../../src/platform/platformRuntimeConfig.js";

describe("failed platform production readiness", () => {
  it("blocks production/domain readiness when Postgres env is missing", () => {
    const report = assessPlatformProductionReadiness({ HOST: "0.0.0.0", PORT: "4361" });
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
      detail: "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY must point to a writable directory.",
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
    expect(formatPlatformProductionReadinessReport(report)).toContain(
      "Web bind: 0.0.0.0:<missing PORT>",
    );
  });
});
