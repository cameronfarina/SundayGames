import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { ownerOrder, type Owner } from "../config/league.js";
import {
  generateProductionProvisioningDocument,
  type ProductionOwnerAccountMapping,
} from "../src/platform/generateProductionProvisioning.js";
import {
  createNodePostgresClient,
  type NodePostgresClient,
} from "../src/platform/postgresClient.js";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";
import {
  executeProductionProvisioning,
  parseProductionProvisioningDocument,
  type ProductionProvisioningDocument,
} from "../src/platform/productionProvisioning.js";
import { createTransactionalProductionProvisioningRepository } from "../src/platform/provisionProduction.js";

const databaseUrl = process.env.MOCKD_POSTGRES_INTEGRATION_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl === undefined || databaseUrl.length === 0
  ? describe.skip
  : describe;

const passwordHashEnvFor = (owner: Owner): string =>
  `MOCKD_PROVISION_${owner.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_PASSWORD_HASH`;

const ownerMapping = (owner: Owner): ProductionOwnerAccountMapping => ({
  owner,
  email: `${owner.toLowerCase()}@example.com`,
  passwordHashEnv: passwordHashEnvFor(owner),
});

const provisioningInput = {
  commissionerOwner: "Cam",
  owners: ownerOrder.map(ownerMapping),
  selectedKeepers: keepers
    .filter(keeper => keeper.status === "confirmed")
    .map(keeper => ({ owner: keeper.owner, player: keeper.player })),
};

const provisioningEnv = Object.fromEntries(ownerOrder.map(owner => [
  passwordHashEnvFor(owner),
  "scrypt$16384$8$1$production-salt$production-derived-key",
]));

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

describeWithPostgres("Postgres production provisioning integration", () => {
  let adminClient: NodePostgresClient;
  let provisioningClient: NodePostgresClient;
  let document: ProductionProvisioningDocument;
  let schemaName: string;

  beforeAll(async () => {
    if (databaseUrl === undefined || databaseUrl.length === 0) {
      throw new Error("MOCKD_POSTGRES_INTEGRATION_DATABASE_URL is required.");
    }

    schemaName = `mockd_provisioning_${randomUUID().replaceAll("-", "")}`;
    adminClient = createNodePostgresClient({ databaseUrl, max: 1 });
    await adminClient.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);

    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
    provisioningClient = createNodePostgresClient({
      databaseUrl: isolatedUrl.toString(),
      max: 1,
    });
    await applyPlatformPostgresMigrations(provisioningClient);
    document = parseProductionProvisioningDocument(
      await generateProductionProvisioningDocument(provisioningInput),
    );
  }, 30_000);

  afterAll(async () => {
    await provisioningClient?.close();
    if (adminClient !== undefined && schemaName !== undefined) {
      await adminClient.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
    }
    await adminClient?.close();
  });

  it("applies a generated document atomically, verifies it, and reruns unchanged", async () => {
    const repository = createTransactionalProductionProvisioningRepository(provisioningClient);
    const warnings: Error[] = [];
    const captureWarning = (warning: Error): void => {
      warnings.push(warning);
    };
    const options = {
      document,
      repository,
      env: provisioningEnv,
      now: new Date("2026-08-13T12:00:00.000Z"),
    };

    process.on("warning", captureWarning);
    try {
      const dryRun = await executeProductionProvisioning({ ...options, mode: "dry-run" });
      const applied = await executeProductionProvisioning({ ...options, mode: "apply" });
      const verified = await executeProductionProvisioning({ ...options, mode: "verify" });
      const reapplied = await executeProductionProvisioning({ ...options, mode: "apply" });

      expect(dryRun.status).toBe("planned");
      expect(dryRun.changes.some(change => change.action === "create")).toBe(true);
      expect(applied.status).toBe("applied");
      expect(verified.status).toBe("verified");
      expect(verified.changes.every(change => change.action === "unchanged")).toBe(true);
      expect(reapplied.status).toBe("unchanged");
      expect(reapplied.auditEventId).toBe(applied.auditEventId);
      await new Promise<void>(resolve => setImmediate(resolve));
    } finally {
      process.off("warning", captureWarning);
    }

    expect(warnings.map(warning => warning.message)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/already executing a query/i)]),
    );
  }, 30_000);
});
