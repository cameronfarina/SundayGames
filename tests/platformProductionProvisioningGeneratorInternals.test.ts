import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { canonicalPlayerIdentityKey } from "../src/data/normalizePlayerName.js";
import type { ProjectionRecord } from "../src/projections.js";
import {
  createProvisioningCatalog,
  type ProvisioningCatalog,
} from "../src/platform/generateProductionProvisioning/catalog.js";
import { buildAccountsByOwner } from "../src/platform/generateProductionProvisioning/accounts.js";
import type {
  ProductionOwnerAccountMappingDocument,
} from "../src/platform/generateProductionProvisioning/contracts.js";
import { buildKeeperRecords } from "../src/platform/generateProductionProvisioning/keeperRecords.js";
import { mappingAt } from "../src/platform/generateProductionProvisioning/ownerMappings.js";
import { provisioningSlug } from "../src/platform/generateProductionProvisioning/slug.js";
import {
  assertOnlyFields,
  objectAt,
  stringAt,
} from "../src/platform/generateProductionProvisioning/validation.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";

const player = (name: string): LiveDraftRoomPlayerCatalogEntry => ({
  name,
  position: "RB",
  expectedPrice: 10,
});

const projection = (id: number, name: string): ProjectionRecord => ({
  id,
  name,
  position: "RB",
  weeks: {},
  weeks1To4: 0,
});

describe("production provisioning catalog construction", () => {
  it("creates deterministic provider identities and preserves optional metadata", () => {
    const catalog = createProvisioningCatalog([
      player("No Projection"),
      { ...player("Projected Player"), teamAbbreviation: "BUF", byeWeek: 7 },
    ], [projection(42, "Projected Player")]);

    expect(catalog.entries).toEqual([
      expect.objectContaining({ playerId: "player-no-projection", provider: "mockd" }),
      expect.objectContaining({
        playerId: "player-espn-42",
        provider: "espn",
        providerPlayerId: "42",
        teamAbbreviation: "BUF",
        byeWeek: 7,
      }),
    ]);
  });

  it("rejects duplicate canonical identities", () => {
    expect(() => createProvisioningCatalog([
      player("Duplicate Player"),
      player("DUPLICATE PLAYER"),
    ], [])).toThrow("duplicate canonical player identities");
  });

  it("rejects duplicate provider player IDs", () => {
    expect(() => createProvisioningCatalog([
      player("First Player"),
      player("Second Player"),
    ], [projection(42, "First Player"), projection(42, "Second Player")]))
      .toThrow("duplicate deterministic player IDs");
  });
});

describe("production provisioning mapping validation", () => {
  it("rejects invalid email addresses and environment variable names", () => {
    expect(() => mappingAt({
      owner: "Owner01",
      email: "not-an-email",
      passwordHashEnv: "VALID_SECRET_NAME",
    }, 0)).toThrow(/expected an email address/i);
    expect(() => mappingAt({
      owner: "Owner01",
      email: "owner@example.com",
      passwordHashEnv: "lowercase-secret-name",
    }, 0)).toThrow(/uppercase environment variable name/i);
  });

  it("rejects values that cannot produce deterministic IDs", () => {
    expect(() => provisioningSlug(" -- ")).toThrow(/cannot create a deterministic id/i);
  });

  it("rejects invalid JSON field shapes without unsafe coercion", () => {
    expect(() => objectAt([], "record")).toThrow(/record: expected an object/i);
    expect(() => stringAt(" ", "name")).toThrow(/name: expected a non-empty string/i);
    expect(() => assertOnlyFields({ first: 1, second: 2 }, [], "record"))
      .toThrow(/unexpected fields first, second/i);
  });

  it("rejects a typed mapping document missing a configured owner", () => {
    const incomplete: ProductionOwnerAccountMappingDocument = {
      commissionerOwner: "Owner11",
      owners: [],
      selectedKeepers: [],
    };
    expect(() => buildAccountsByOwner(incomplete)).toThrow(/missing configured owner Owner01/i);
  });
});

describe("production provisioning keeper resolution", () => {
  const mapping: ProductionOwnerAccountMappingDocument = {
    commissionerOwner: "Owner11",
    owners: [],
    selectedKeepers: [{ owner: "Owner03", player: "Rico Dowdle" }],
  };
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
  const keeperPlayer = {
    playerId: "player-rico-dowdle",
    ...player("Rico Dowdle"),
  };
  const catalog: ProvisioningCatalog = {
    entries: [keeperPlayer],
    byIdentity: new Map([[canonicalPlayerIdentityKey(keeperPlayer.name), keeperPlayer]]),
  };

  it("rejects a keeper whose team is absent", () => {
    expect(() => buildKeeperRecords(mapping, [], catalog)).toThrow(/unknown owner Owner03/i);
  });

  it("rejects a keeper whose player is absent", () => {
    const emptyCatalog: ProvisioningCatalog = { entries: [], byIdentity: new Map() };
    expect(() => buildKeeperRecords(mapping, season.teams, emptyCatalog))
      .toThrow(/Rico Dowdle is missing/i);
  });
});
