import { describe, expect, it } from "vitest";
import { hashPassword } from "../src/platform/auth.js";
import { InMemoryLiveDraftRoomSetupRepository } from "../src/platform/liveDraftRoomSetups.js";
import { InMemoryPlatformStore } from "../src/platform/platformApp.js";
import { PostgresProductionProvisioningRepository } from "../src/platform/postgresProductionProvisioning.js";
import type {
  ProductionProvisioningContext,
  ResolvedProductionProvisioningDocument,
} from "../src/platform/productionProvisioning.js";
import { parseProductionProvisioningDocument } from "../src/platform/productionProvisioning.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

class EmptyQueryClient implements PostgresQueryClient {
  async query<TRow = Record<string, unknown>>(): Promise<PostgresQueryResult<TRow>> {
    return { rows: [], rowCount: 0 };
  }
}

const context: ProductionProvisioningContext = {
  inputDigest: "digest-1",
  auditEventId: "audit-1",
  now: new Date("2026-08-14T12:00:00.000Z"),
};

const document = (): ResolvedProductionProvisioningDocument => {
  const parsed = parseProductionProvisioningDocument(JSON.stringify({
    schemaVersion: "mockd.production-provisioning/v1",
    provisioningId: "launch-1",
    environment: "production",
    actorAccountId: "account-1",
    accounts: [{
      id: "account-1",
      email: "owner@example.com",
      passwordHashEnv: "OWNER_PASSWORD_HASH",
    }],
    league: {
      id: "league-1",
      externalLeagueId: "league-1",
      name: "League One",
      provider: "yahoo",
    },
    memberships: [{
      accountId: "account-1",
      role: "owner",
      ownerId: "owner-1",
      teamId: "team-1",
    }],
    season: {
      id: "season-1",
      year: 2026,
      status: "published",
      settings: {
        auction: { budgetDollars: 200, minimumBidDollars: 1 },
        roster: {
          rosterSize: 1,
          lineup: { RB: 1 },
          rosterMaximums: { QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DST: 1 },
        },
        keeperPolicy: {
          mode: "previous-cost-multiplier",
          multiplier: 1.2,
          rounding: "ceil",
        },
      },
      teams: [{
        id: "team-1",
        ownerId: "owner-1",
        ownerDisplayName: "Owner One",
        name: "Team One",
        draftOrderPosition: 1,
      }],
    },
    catalog: [{
      playerId: "player-1",
      name: "Player One",
      position: "RB",
      expectedPrice: 20,
    }],
    initialRosters: [{
      teamId: "team-1",
      playerId: "player-1",
      price: 10,
      source: "keeper",
    }],
    keepers: [{
      id: "keeper-1",
      teamId: "team-1",
      playerId: "player-1",
      keeperCost: 10,
      status: "published",
      source: "commissioner",
    }],
  }));

  return {
    ...parsed,
    accounts: parsed.accounts.map(account => ({
      ...account,
      passwordHash: hashPassword("a sufficiently long production password1!"),
    })),
  };
};

const repository = (): PostgresProductionProvisioningRepository => {
  const store = new InMemoryPlatformStore();
  return new PostgresProductionProvisioningRepository({
    client: new EmptyQueryClient(),
    authRepository: store.authRepository,
    leagueSetupRepository: store,
    draftSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
  });
};

describe("PostgresProductionProvisioningRepository", () => {
  it("reports every absent production resource in deterministic order", async () => {
    const inspection = await repository().inspect(document(), context);

    expect(inspection).toEqual({
      changes: [
        { resourceType: "account", resourceId: "account-1", action: "create" },
        { resourceType: "league-season", resourceId: "season-1", action: "create" },
        { resourceType: "season-draft-setup", resourceId: "season-1", action: "create" },
        { resourceType: "player", resourceId: "player-1", action: "create" },
        { resourceType: "keeper", resourceId: "keeper-1", action: "create" },
        { resourceType: "audit-event", resourceId: "audit-1", action: "create" },
      ],
      conflicts: [],
      auditRecorded: false,
    });
  });

  it("rejects a keeper whose catalog player is absent", async () => {
    const validDocument = document();
    const malformedDocument: ResolvedProductionProvisioningDocument = {
      ...validDocument,
      catalog: [],
    };

    await expect(repository().inspect(malformedDocument, context))
      .rejects.toThrow("Missing catalog player player-1.");
  });
});
