import { describe, expect, it } from "vitest";
import {
  executeProductionProvisioning,
  parseProductionProvisioningDocument,
  type ProductionProvisioningRepository,
} from "../src/platform/productionProvisioning.js";
import { InMemoryLiveDraftRoomSetupRepository } from "../src/platform/liveDraftRoomSetups.js";
import { InMemoryPlatformStore } from "../src/platform/platformApp.js";
import { PostgresProductionProvisioningRepository } from "../src/platform/postgresProductionProvisioning.js";
import { runProductionProvisioningCli } from "../src/platform/provisionProduction.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

const validDocument = {
  schemaVersion: "mockd.production-provisioning/v1",
  provisioningId: "mockd-2026-launch",
  environment: "production",
  actorAccountId: "account-owner11",
  accounts: [
    {
      id: "account-owner11",
      email: "owner11@example.com",
      passwordHashEnv: "MOCKD_PROVISION_CAM_PASSWORD_HASH",
    },
  ],
  league: {
    id: "league-real-123",
    externalLeagueId: "123",
    name: "Real Auction League",
    provider: "yahoo",
  },
  memberships: [
    {
      accountId: "account-owner11",
      role: "owner",
      ownerId: "owner-owner11",
      teamId: "team-owner11",
    },
  ],
  season: {
    id: "season-real-2026",
    year: 2026,
    status: "published",
    draft: {
      scheduledAt: "2026-08-29T23:00:00.000Z",
      timezone: "America/New_York",
    },
    settings: {
      auction: {
        budgetDollars: 200,
        minimumBidDollars: 1,
      },
      roster: {
        rosterSize: 2,
        lineup: { QB: 1, RB: 1 },
        rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
      },
      keeperPolicy: {
        mode: "previous-cost-multiplier",
        multiplier: 1.2,
        rounding: "ceil",
      },
    },
    teams: [
      {
        id: "team-owner11",
        ownerId: "owner-owner11",
        ownerDisplayName: "Owner11",
        name: "Sunday Scaries",
        draftOrderPosition: 1,
      },
    ],
  },
  catalog: [
    {
      playerId: "player-jalen-hurts",
      name: "Jalen Hurts",
      position: "QB",
      expectedPrice: 24,
      provider: "yahoo",
      providerPlayerId: "30123",
      teamAbbreviation: "PHI",
      byeWeek: 9,
    },
  ],
  initialRosters: [
    {
      teamId: "team-owner11",
      playerId: "player-jalen-hurts",
      price: 18,
      source: "keeper",
    },
  ],
  keepers: [
    {
      id: "keeper-owner11-hurts-2026",
      teamId: "team-owner11",
      playerId: "player-jalen-hurts",
      keeperCost: 18,
      previousCost: 15,
      status: "published",
      source: "commissioner",
    },
  ],
} as const;

describe("production provisioning document", () => {
  it("parses a complete versioned production document", () => {
    const document = parseProductionProvisioningDocument(JSON.stringify(validDocument));

    expect(document.schemaVersion).toBe("mockd.production-provisioning/v1");
    expect(document.league.id).toBe("league-real-123");
    expect(document.season.teams[0]?.leagueSeasonId).toBe("season-real-2026");
    expect(document.memberships[0]).toMatchObject({
      userId: "account-owner11",
      leagueId: "league-real-123",
      teamId: "team-owner11",
    });
    expect(document.catalog[0]?.playerId).toBe("player-jalen-hurts");
    expect(document.keepers[0]?.playerId).toBe("player-jalen-hurts");
  });

  it("refuses local E2E fixture identities even when labeled production", () => {
    const localFixtureDocument = {
      ...validDocument,
      accounts: [
        {
          ...validDocument.accounts[0],
          id: "acct_mockd_e2e_cam",
          email: "commissioner@mockd.local",
        },
      ],
      actorAccountId: "acct_mockd_e2e_cam",
      memberships: [
        {
          ...validDocument.memberships[0],
          accountId: "acct_mockd_e2e_cam",
        },
      ],
    };

    expect(() => parseProductionProvisioningDocument(JSON.stringify(localFixtureDocument)))
      .toThrow(/local E2E fixture marker/i);
  });
});

describe("production provisioning execution", () => {
  it("returns an auditable dry-run plan without applying changes", async () => {
    const document = parseProductionProvisioningDocument(JSON.stringify(validDocument));
    let applyCount = 0;
    const repository: ProductionProvisioningRepository = {
      inspect: async () => ({
        changes: [
          { resourceType: "account", resourceId: "account-owner11", action: "create" },
          { resourceType: "league-season", resourceId: "season-real-2026", action: "create" },
        ],
        conflicts: [],
        auditRecorded: false,
      }),
      apply: async () => {
        applyCount += 1;
      },
      verify: async () => [],
    };

    const result = await executeProductionProvisioning({
      mode: "dry-run",
      document,
      repository,
      env: {
        MOCKD_PROVISION_CAM_PASSWORD_HASH:
          "scrypt$16384$8$1$production-salt$production-derived-key",
      },
      now: new Date("2026-08-10T16:00:00.000Z"),
    });

    expect(result).toMatchObject({
      mode: "dry-run",
      status: "planned",
      provisioningId: "mockd-2026-launch",
      changes: [
        { resourceType: "account", resourceId: "account-owner11", action: "create" },
        { resourceType: "league-season", resourceId: "season-real-2026", action: "create" },
      ],
    });
    expect(result.inputDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.auditEventId).toBe(`production-provisioning:mockd-2026-launch:${result.inputDigest}`);
    expect(applyCount).toBe(0);
  });

  it("applies once and skips writes when the same audited input is rerun", async () => {
    const document = parseProductionProvisioningDocument(JSON.stringify(validDocument));
    let applied = false;
    let applyCount = 0;
    const repository: ProductionProvisioningRepository = {
      inspect: async () => ({
        changes: [{
          resourceType: "production-provisioning",
          resourceId: "mockd-2026-launch",
          action: applied ? "unchanged" : "create",
        }],
        conflicts: [],
        auditRecorded: applied,
      }),
      apply: async () => {
        applyCount += 1;
        applied = true;
      },
      verify: async () => [],
    };
    const options = {
      mode: "apply" as const,
      document,
      repository,
      env: {
        MOCKD_PROVISION_CAM_PASSWORD_HASH:
          "scrypt$16384$8$1$production-salt$production-derived-key",
      },
      now: new Date("2026-08-10T16:00:00.000Z"),
    };

    const firstResult = await executeProductionProvisioning(options);
    const rerunResult = await executeProductionProvisioning(options);

    expect(firstResult.status).toBe("applied");
    expect(rerunResult.status).toBe("unchanged");
    expect(rerunResult.auditEventId).toBe(firstResult.auditEventId);
    expect(applyCount).toBe(1);
  });

  it("verifies matching provisioned state without applying changes", async () => {
    const document = parseProductionProvisioningDocument(JSON.stringify(validDocument));
    let applyCount = 0;
    let verifyCount = 0;
    const repository: ProductionProvisioningRepository = {
      inspect: async () => ({
        changes: [{
          resourceType: "production-provisioning",
          resourceId: "mockd-2026-launch",
          action: "unchanged",
        }],
        conflicts: [],
        auditRecorded: true,
      }),
      apply: async () => {
        applyCount += 1;
      },
      verify: async () => {
        verifyCount += 1;
        return [];
      },
    };

    const result = await executeProductionProvisioning({
      mode: "verify",
      document,
      repository,
      env: {
        MOCKD_PROVISION_CAM_PASSWORD_HASH:
          "scrypt$16384$8$1$production-salt$production-derived-key",
      },
    });

    expect(result.status).toBe("verified");
    expect(applyCount).toBe(0);
    expect(verifyCount).toBe(1);
  });

  it("refuses to repair drift beneath an existing audit receipt", async () => {
    const document = parseProductionProvisioningDocument(JSON.stringify(validDocument));
    let applyCount = 0;
    const repository: ProductionProvisioningRepository = {
      inspect: async () => ({
        changes: [{ resourceType: "player", resourceId: "player-jalen-hurts", action: "create" }],
        conflicts: [],
        auditRecorded: true,
      }),
      apply: async () => {
        applyCount += 1;
      },
      verify: async () => [],
    };

    await expect(executeProductionProvisioning({
      mode: "apply",
      document,
      repository,
      env: {
        MOCKD_PROVISION_CAM_PASSWORD_HASH:
          "scrypt$16384$8$1$production-salt$production-derived-key",
      },
    })).rejects.toThrow(/audit receipt exists.*state differs/i);
    expect(applyCount).toBe(0);
  });
});

const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

class ProvisioningPostgresClient implements PostgresQueryClient {
  readonly players = new Map<string, Record<string, unknown>>();
  readonly keepers = new Map<string, Record<string, unknown> & { league_season_id: string }>();
  readonly auditEvents = new Set<string>();

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    const sql = normalizeSql(text);
    if (sql.startsWith("SELECT id, provider, provider_player_id")) {
      const [playerIds] = values as readonly [readonly string[]];
      return {
        rows: playerIds.flatMap(playerId => {
          const player = this.players.get(playerId);
          return player === undefined ? [] : [player as TRow];
        }),
        rowCount: null,
      };
    }
    if (sql.startsWith("INSERT INTO players")) {
      const [id, provider, providerPlayerId, name, position, nflTeam, byeWeek] = values;
      this.players.set(String(id), {
        id,
        provider,
        provider_player_id: providerPlayerId,
        canonical_name: name,
        position,
        nfl_team: nflTeam,
        bye_week: byeWeek,
        active: true,
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT id, fantasy_team_id, player_id")) {
      const [seasonId] = values;
      return {
        rows: [...this.keepers.values()]
          .filter(keeper => keeper.league_season_id === seasonId)
          .map(keeper => {
            const { league_season_id: _leagueSeasonId, ...row } = keeper;
            return row as TRow;
          }),
        rowCount: null,
      };
    }
    if (sql.startsWith("INSERT INTO keeper_declarations")) {
      const [id, seasonId, teamId, playerId, playerName, position, keeperCost, previousCost, status, source] = values;
      this.keepers.set(String(id), {
        id,
        league_season_id: String(seasonId),
        fantasy_team_id: teamId,
        player_id: playerId,
        player_name: playerName,
        position,
        keeper_cost: keeperCost,
        previous_cost: previousCost,
        status,
        source,
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql === "SELECT id FROM audit_events WHERE id = $1") {
      const [auditEventId] = values as readonly [string];
      return {
        rows: this.auditEvents.has(auditEventId) ? [{ id: auditEventId } as TRow] : [],
        rowCount: null,
      };
    }
    if (sql.startsWith("INSERT INTO audit_events")) {
      const [auditEventId] = values as readonly [string];
      this.auditEvents.add(auditEventId);
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected provisioning test query: ${sql}`);
  }
}

describe("Postgres production provisioning repository", () => {
  it("includes the season draft setup repository in dry-run expectations", async () => {
    const store = new InMemoryPlatformStore();
    const repository = new PostgresProductionProvisioningRepository({
      client: new ProvisioningPostgresClient(),
      authRepository: store.authRepository,
      leagueSetupRepository: store,
      draftSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
    });

    const result = await executeProductionProvisioning({
      mode: "dry-run",
      document: parseProductionProvisioningDocument(JSON.stringify(validDocument)),
      repository,
      env: {
        MOCKD_PROVISION_CAM_PASSWORD_HASH:
          "scrypt$16384$8$1$production-salt$production-derived-key",
      },
    });

    expect(result.changes).toContainEqual({
      resourceType: "season-draft-setup",
      resourceId: "season-real-2026",
      action: "create",
    });
  });

  it("applies every production resource through its repository and is safe to rerun", async () => {
    const client = new ProvisioningPostgresClient();
    const store = new InMemoryPlatformStore();
    const draftSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const repository = new PostgresProductionProvisioningRepository({
      client,
      authRepository: store.authRepository,
      leagueSetupRepository: store,
      draftSetupRepository,
    });
    const options = {
      mode: "apply" as const,
      document: parseProductionProvisioningDocument(JSON.stringify(validDocument)),
      repository,
      env: {
        MOCKD_PROVISION_CAM_PASSWORD_HASH:
          "scrypt$16384$8$1$production-salt$production-derived-key",
      },
      now: new Date("2026-08-10T16:00:00.000Z"),
    };

    const firstResult = await executeProductionProvisioning(options);
    const rerunResult = await executeProductionProvisioning(options);

    expect(firstResult.status).toBe("applied");
    expect(rerunResult.status).toBe("unchanged");
    expect(await store.findLeagueSeason("season-real-2026")).not.toBeNull();
    expect(await draftSetupRepository.findForSeason("season-real-2026")).toMatchObject({
      sourceVersion: "mockd-2026-launch",
      playerCatalog: [{ name: "Jalen Hurts", position: "QB", expectedPrice: 24 }],
      initialRosters: [{ teamId: "team-owner11", playerName: "Jalen Hurts", source: "keeper" }],
    });
    expect(client.players.size).toBe(1);
    expect(client.keepers.size).toBe(1);
    expect(client.auditEvents).toEqual(new Set([firstResult.auditEventId]));
  });
});

describe("production provisioning CLI", () => {
  it("requires Postgres even for a dry run", async () => {
    await expect(runProductionProvisioningCli({
      argv: ["production.json", "--dry-run"],
      env: {},
    })).rejects.toThrow("DATABASE_URL is required");
  });

  it("reads the requested JSON file and runs verify against Postgres", async () => {
    let readPath = "";
    let closed = false;
    const output: string[] = [];
    const repository: ProductionProvisioningRepository = {
      inspect: async () => ({
        changes: [{
          resourceType: "production-provisioning",
          resourceId: "mockd-2026-launch",
          action: "unchanged",
        }],
        conflicts: [],
        auditRecorded: true,
      }),
      apply: async () => undefined,
      verify: async () => [],
    };

    const result = await runProductionProvisioningCli({
      argv: ["/secure/mockd-production-2026.json", "--verify"],
      env: {
        DATABASE_URL: "postgresql://production.example/mockd",
        MOCKD_PROVISION_CAM_PASSWORD_HASH:
          "scrypt$16384$8$1$production-salt$production-derived-key",
      },
      dependencies: {
        readInputFile: async path => {
          readPath = path;
          return JSON.stringify(validDocument);
        },
        createRuntime: () => ({
          repository,
          close: async () => {
            closed = true;
          },
        }),
        writeOutput: value => output.push(value),
      },
    });

    expect(readPath).toBe("/secure/mockd-production-2026.json");
    expect(result).toMatchObject({ mode: "verify", status: "verified" });
    expect(JSON.parse(output[0] ?? "{}")).toMatchObject({
      mode: "verify",
      provisioningId: "mockd-2026-launch",
    });
    expect(closed).toBe(true);
  });

  it("refuses fixture-named input paths before reading them", async () => {
    let readCount = 0;

    await expect(runProductionProvisioningCli({
      argv: ["/tmp/e2e/production.json", "--dry-run"],
      env: { DATABASE_URL: "postgresql://production.example/mockd" },
      dependencies: {
        readInputFile: async () => {
          readCount += 1;
          return JSON.stringify(validDocument);
        },
      },
    })).rejects.toThrow(/refuses E2E or fixture input paths/i);
    expect(readCount).toBe(0);
  });
});
