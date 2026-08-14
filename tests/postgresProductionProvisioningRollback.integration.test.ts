import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { ownerOrder, type Owner } from "../config/league.js";
import { hashPassword } from "../src/platform/auth.js";
import {
  generateProductionProvisioningDocument,
  type ProductionOwnerAccountMapping,
} from "../src/platform/generateProductionProvisioning.js";
import {
  createNodePostgresClient,
  type NodePostgresClient,
} from "../src/platform/postgresClient.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
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
const passwordEnvFor = (owner: Owner): string =>
  `MOCKD_PROVISION_${owner.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_PASSWORD_HASH`;
const ownerMapping = (owner: Owner): ProductionOwnerAccountMapping => ({
  owner,
  email: `${owner.toLowerCase()}@example.com`,
  passwordHashEnv: passwordEnvFor(owner),
});
const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

class AuditFailureClient implements PostgresTransactionalQueryClient {
  constructor(private readonly client: NodePostgresClient) {}

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    return await this.client.query<TRow>(text, values);
  }

  async transaction<T>(
    operation: (client: PostgresQueryClient) => Promise<T>,
  ): Promise<T> {
    return await this.client.transaction(async transactionClient => await operation({
      query: async <TRow = Record<string, unknown>>(
        text: string,
        values: readonly unknown[] = [],
      ): Promise<PostgresQueryResult<TRow>> => {
        if (/^INSERT INTO audit_events/.test(text.trim())) throw new Error("forced audit failure");
        return await transactionClient.query<TRow>(text, values);
      },
    }));
  }
}

describeWithPostgres("Postgres production provisioning rollback", () => {
  let adminClient: NodePostgresClient;
  let provisioningClient: NodePostgresClient;
  let document: ProductionProvisioningDocument;
  let schemaName: string;

  beforeAll(async () => {
    if (databaseUrl === undefined || databaseUrl.length === 0) {
      throw new Error("MOCKD_POSTGRES_INTEGRATION_DATABASE_URL is required.");
    }
    schemaName = `mockd_provisioning_rollback_${randomUUID().replaceAll("-", "")}`;
    adminClient = createNodePostgresClient({ databaseUrl, max: 1 });
    await adminClient.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
    provisioningClient = createNodePostgresClient({ databaseUrl: isolatedUrl.toString(), max: 1 });
    await applyPlatformPostgresMigrations(provisioningClient);
    document = parseProductionProvisioningDocument(await generateProductionProvisioningDocument({
      commissionerOwner: "Owner11",
      owners: ownerOrder.map(ownerMapping),
      selectedKeepers: keepers
        .filter(keeper => keeper.status === "confirmed")
        .map(keeper => ({ owner: keeper.owner, player: keeper.player })),
    }));
  }, 30_000);

  afterAll(async () => {
    await provisioningClient?.close();
    if (adminClient !== undefined && schemaName !== undefined) {
      await adminClient.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
    }
    await adminClient?.close();
  });

  it("rolls back every write when the final audit receipt fails", async () => {
    const repository = createTransactionalProductionProvisioningRepository(
      new AuditFailureClient(provisioningClient),
    );
    const passwordHash = hashPassword("a sufficiently long production password");
    const env = Object.fromEntries(ownerOrder.map(owner => [passwordEnvFor(owner), passwordHash]));

    await expect(executeProductionProvisioning({
      mode: "apply",
      document,
      repository,
      env,
    })).rejects.toThrow("forced audit failure");

    for (const table of ["accounts", "leagues", "league_seasons", "players", "keeper_declarations"]) {
      const result = await provisioningClient.query<{ count: string }>(`SELECT count(*) FROM ${table}`);
      expect(result.rows[0]?.count).toBe("0");
    }
  }, 30_000);
});
