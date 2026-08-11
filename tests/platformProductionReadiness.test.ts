import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPlatformProductionReadinessFromEnv,
  probeWritableDraftToolsDirectory,
} from "../src/platform/checkPlatformProductionReadiness.js";

const productionEnv = {
  DATABASE_URL: "postgres://mockd:secret@database.invalid:5432/mockd",
  HOST: "0.0.0.0",
  PORT: "443",
  MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
};

describe("platform production readiness check", () => {
  let temporaryDirectory: string | undefined;

  afterEach(async () => {
    if (temporaryDirectory !== undefined) {
      await rm(temporaryDirectory, { force: true, recursive: true });
      temporaryDirectory = undefined;
    }
  });

  it("requires a successful Postgres connectivity probe", async () => {
    const probeDatabase = vi.fn(async () => ({ status: "unreachable" as const }));
    const probeDraftStorage = vi.fn(async () => undefined);

    const report = await checkPlatformProductionReadinessFromEnv(productionEnv, {
      probeDatabase,
      probeDraftStorage,
    });

    expect(probeDatabase).toHaveBeenCalledWith(productionEnv.DATABASE_URL);
    expect(probeDraftStorage).toHaveBeenCalledWith(productionEnv.MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY);
    expect(report.ready).toBe(false);
    expect(report.checks).toContainEqual({
      status: "fail",
      label: "Postgres connectivity",
      detail: "Could not connect to the configured Postgres database.",
    });
    expect(JSON.stringify(report)).not.toContain("secret");
    expect(JSON.stringify(report)).not.toContain("database.invalid");
  });

  it("requires every platform migration to be applied", async () => {
    const probeDatabase = vi.fn(async () => ({
      status: "migrations_missing" as const,
      missingMigrationIds: ["platform-invitations-v3"],
    }));

    const report = await checkPlatformProductionReadinessFromEnv(productionEnv, {
      probeDatabase,
      probeDraftStorage: async () => undefined,
    });

    expect(report.ready).toBe(false);
    expect(report.checks).toContainEqual({
      status: "fail",
      label: "Postgres migrations",
      detail: "Missing required migrations: platform-invitations-v3.",
    });
  });

  it("requires writable private draft storage", async () => {
    const report = await checkPlatformProductionReadinessFromEnv(productionEnv, {
      probeDatabase: async () => ({ status: "ready" }),
      probeDraftStorage: async () => {
        throw new Error("EACCES");
      },
    });

    expect(report.ready).toBe(false);
    expect(report.checks).toContainEqual({
      status: "fail",
      label: "Private draft storage write access",
      detail: "Could not write to and clean up the configured private draft storage directory.",
    });
  });

  it("reports successful live dependency probes", async () => {
    const probeDatabase = vi.fn(async () => ({ status: "ready" as const }));

    const report = await checkPlatformProductionReadinessFromEnv(productionEnv, {
      probeDatabase,
      probeDraftStorage: async () => undefined,
    });

    expect(report.ready).toBe(true);
    expect(report.checks).toContainEqual({
      status: "pass",
      label: "Postgres connectivity",
      detail: "Connected to the configured Postgres database.",
    });
    expect(report.checks).toContainEqual({
      status: "pass",
      label: "Postgres migrations",
      detail: "All required platform migrations are applied.",
    });
    expect(report.checks).toContainEqual({
      status: "pass",
      label: "Private draft storage write access",
      detail: "The configured private draft storage directory passed a write and delete probe.",
    });
  });

  it("does not probe when static production configuration already fails", async () => {
    const probeDatabase = vi.fn(async () => ({ status: "ready" as const }));
    const probeDraftStorage = vi.fn(async () => undefined);

    const report = await checkPlatformProductionReadinessFromEnv({
      HOST: "0.0.0.0",
      PORT: "443",
    }, { probeDatabase, probeDraftStorage });

    expect(report.ready).toBe(false);
    expect(probeDatabase).not.toHaveBeenCalled();
    expect(probeDraftStorage).not.toHaveBeenCalled();
    expect(report.checks).not.toContainEqual(expect.objectContaining({
      label: "Postgres connectivity",
    }));
  });

  it("writes, flushes, and removes a private draft storage probe", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-readiness-"));
    const draftToolsDirectory = join(temporaryDirectory, "draft-tools");

    await probeWritableDraftToolsDirectory(draftToolsDirectory);

    await expect(readdir(draftToolsDirectory)).resolves.toEqual([]);
  });

  it("rejects a private draft storage path that is not a directory", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-readiness-"));
    const filePath = join(temporaryDirectory, "not-a-directory");
    await writeFile(filePath, "occupied", "utf8");

    await expect(probeWritableDraftToolsDirectory(filePath)).rejects.toThrow();
  });
});
