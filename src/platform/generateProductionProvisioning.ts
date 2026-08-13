import { keepers } from "../../config/keepers.js";
import { leagueConfig, ownerOrder, type Owner } from "../../config/league.js";
import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import { loadCurrentProjections } from "../projections.js";
import { normalizeEmail } from "./auth.js";
import { buildCurrentMockdLeagueSeason } from "./leagueSeason.js";
import { loadCurrentPlayerCatalog } from "./localDemoFixtures.js";
import {
  parseProductionProvisioningDocument,
  productionProvisioningSchemaVersion,
} from "./productionProvisioning.js";

export interface ProductionOwnerAccountMapping {
  owner: Owner;
  email: string;
  passwordHashEnv: string;
}

export interface ProductionKeeperSelection {
  owner: Owner;
  player: string;
}

export interface ProductionOwnerAccountMappingDocument {
  commissionerOwner: Owner;
  owners: readonly ProductionOwnerAccountMapping[];
  selectedKeepers: readonly ProductionKeeperSelection[];
}

type JsonObject = Record<string, unknown>;

const currentSeasonYear = 2026;
const currentProjectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const passwordHashEnvPattern = /^[A-Z][A-Z0-9_]*$/;

const fail = (path: string, message: string): never => {
  throw new Error(`Invalid production owner/account mapping at ${path}: ${message}`);
};

const objectAt = (value: unknown, path: string): JsonObject => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(path, "expected an object.");
  }

  return value as JsonObject;
};

const stringAt = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(path, "expected a non-empty string.");
  }

  return value.trim();
};

const assertOnlyFields = (
  value: JsonObject,
  expectedFields: readonly string[],
  path: string,
): void => {
  const unexpectedFields = Object.keys(value).filter(field => !expectedFields.includes(field));
  if (unexpectedFields.length > 0) {
    fail(path, `unexpected field${unexpectedFields.length === 1 ? "" : "s"} ${unexpectedFields.join(", ")}.`);
  }
};

const ownerAt = (value: unknown, path: string): Owner => {
  const owner = stringAt(value, path);
  const configuredOwner = ownerOrder.find(candidate => candidate === owner);
  if (configuredOwner === undefined) return fail(path, `unknown configured owner "${owner}".`);

  return configuredOwner;
};

const mappingAt = (value: unknown, index: number): ProductionOwnerAccountMapping => {
  const path = `owners[${index}]`;
  const record = objectAt(value, path);
  assertOnlyFields(record, ["owner", "email", "passwordHashEnv"], path);

  let email: string;
  try {
    email = normalizeEmail(stringAt(record.email, `${path}.email`));
  } catch {
    return fail(`${path}.email`, "expected an email address.");
  }
  const passwordHashEnv = stringAt(record.passwordHashEnv, `${path}.passwordHashEnv`);
  if (!passwordHashEnvPattern.test(passwordHashEnv)) {
    fail(`${path}.passwordHashEnv`, "expected an uppercase environment variable name.");
  }

  return {
    owner: ownerAt(record.owner, `${path}.owner`),
    email,
    passwordHashEnv,
  };
};

const keeperSelectionKey = (selection: ProductionKeeperSelection): string =>
  `${selection.owner}\0${selection.player}`;

const configuredKeeperBySelectionKey = new Map(
  keepers.map(keeper => [keeperSelectionKey(keeper), keeper]),
);

const keeperSelectionAt = (value: unknown, index: number): ProductionKeeperSelection => {
  const path = `selectedKeepers[${index}]`;
  const record = objectAt(value, path);
  assertOnlyFields(record, ["owner", "player"], path);
  const selection = {
    owner: ownerAt(record.owner, `${path}.owner`),
    player: stringAt(record.player, `${path}.player`),
  };
  if (!configuredKeeperBySelectionKey.has(keeperSelectionKey(selection))) {
    fail(path, "does not exactly match a configured keeper by owner and player.");
  }

  return selection;
};

const assertUnique = (
  mappings: readonly ProductionOwnerAccountMapping[],
  field: keyof ProductionOwnerAccountMapping,
): void => {
  const seen = new Set<string>();
  for (const mapping of mappings) {
    const value = mapping[field];
    if (seen.has(value)) fail(`owners[].${field}`, `duplicate value "${value}".`);
    seen.add(value);
  }
};

const mappingDocumentAt = (value: unknown): ProductionOwnerAccountMappingDocument => {
  const record = objectAt(value, "$");
  assertOnlyFields(record, ["commissionerOwner", "owners", "selectedKeepers"], "$");
  const owners = record.owners;
  if (!Array.isArray(owners)) return fail("owners", "expected an array.");
  const selectedKeepers = record.selectedKeepers;
  if (!Array.isArray(selectedKeepers)) return fail("selectedKeepers", "expected an array.");

  const mappings = owners.map((mapping, index) => mappingAt(mapping, index));
  assertUnique(mappings, "owner");
  assertUnique(mappings, "email");
  assertUnique(mappings, "passwordHashEnv");

  const mappingsByOwner = new Map(mappings.map(mapping => [mapping.owner, mapping]));
  for (const owner of ownerOrder) {
    if (!mappingsByOwner.has(owner)) fail("owners", `missing configured owner ${owner}.`);
  }
  if (mappings.length !== ownerOrder.length) {
    fail("owners", `expected exactly ${ownerOrder.length} configured owner mappings.`);
  }

  const commissionerOwner = ownerAt(record.commissionerOwner, "commissionerOwner");
  const keeperSelections = selectedKeepers.map((selection, index) => keeperSelectionAt(selection, index));
  const seenKeeperSelections = new Set<string>();
  for (const selection of keeperSelections) {
    const key = keeperSelectionKey(selection);
    if (seenKeeperSelections.has(key)) {
      fail("selectedKeepers", `duplicate keeper selection for ${selection.owner} and ${selection.player}.`);
    }
    seenKeeperSelections.add(key);
  }

  return {
    commissionerOwner,
    owners: ownerOrder.map(owner => mappingsByOwner.get(owner)
      ?? fail("owners", `missing configured owner ${owner}.`)),
    selectedKeepers: keepers
      .filter(keeper => seenKeeperSelections.has(keeperSelectionKey(keeper)))
      .map(keeper => ({ owner: keeper.owner, player: keeper.player })),
  };
};

const slugFor = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length === 0) throw new Error(`Cannot create a deterministic ID for "${value}".`);

  return slug;
};

export const parseProductionOwnerAccountMappingDocument = (
  content: string,
): ProductionOwnerAccountMappingDocument => {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return fail("$", "expected valid JSON.");
  }

  return mappingDocumentAt(value);
};

export const generateProductionProvisioningDocument = async (
  input: unknown,
): Promise<string> => {
  const mappingDocument = mappingDocumentAt(input);
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    seasonYear: currentSeasonYear,
    setupStatus: "published",
  });
  const mappingsByOwner = new Map(mappingDocument.owners.map(mapping => [mapping.owner, mapping]));
  const teamByOwner = new Map(season.teams.map(team => [team.ownerDisplayName, team]));
  const accountsByOwner = new Map(ownerOrder.map(owner => [owner, {
    id: `account-${slugFor(owner)}`,
    email: mappingsByOwner.get(owner)?.email ?? fail("owners", `missing configured owner ${owner}.`),
    passwordHashEnv: mappingsByOwner.get(owner)?.passwordHashEnv
      ?? fail("owners", `missing configured owner ${owner}.`),
  }]));

  const [currentCatalog, projections] = await Promise.all([
    loadCurrentPlayerCatalog(),
    loadCurrentProjections({ projectionPath: currentProjectionPath }),
  ]);
  const projectionByIdentity = new Map(
    projections.map(projection => [canonicalPlayerIdentityKey(projection.name), projection]),
  );
  const catalog = currentCatalog.map(player => {
    const identity = canonicalPlayerIdentityKey(player.name);
    const projection = projectionByIdentity.get(identity);

    return {
      playerId: projection === undefined ? `player-${slugFor(identity)}` : `player-espn-${projection.id}`,
      name: player.name,
      position: player.position,
      expectedPrice: player.expectedPrice,
      provider: projection === undefined ? "mockd" : "espn",
      ...(projection === undefined ? {} : { providerPlayerId: String(projection.id) }),
      ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
      ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
    };
  });
  const catalogByIdentity = new Map(
    catalog.map(player => [canonicalPlayerIdentityKey(player.name), player]),
  );
  if (catalogByIdentity.size !== catalog.length) {
    throw new Error("Current player catalog contains duplicate canonical player identities.");
  }
  if (new Set(catalog.map(player => player.playerId)).size !== catalog.length) {
    throw new Error("Current player catalog produces duplicate deterministic player IDs.");
  }

  const selectedKeeperKeys = new Set(mappingDocument.selectedKeepers.map(keeperSelectionKey));
  const keeperRecords = keepers
    .filter(keeper => selectedKeeperKeys.has(keeperSelectionKey(keeper)))
    .map(keeper => {
      const team = teamByOwner.get(keeper.owner);
      if (team === undefined) throw new Error(`Current keeper references unknown owner ${keeper.owner}.`);
      const player = catalogByIdentity.get(canonicalPlayerIdentityKey(keeper.player));
      if (player === undefined) {
        throw new Error(`Current keeper ${keeper.player} is missing from the current catalog.`);
      }

      return { keeper, team, player };
    });
  const rawDocument = {
    schemaVersion: productionProvisioningSchemaVersion,
    provisioningId: `mockd-${leagueConfig.leagueId}-${currentSeasonYear}-production`,
    environment: "production",
    actorAccountId: accountsByOwner.get(mappingDocument.commissionerOwner)?.id
      ?? fail("commissionerOwner", "must reference a configured owner mapping."),
    accounts: ownerOrder.map(owner => accountsByOwner.get(owner)
      ?? fail("owners", `missing configured owner ${owner}.`)),
    league: season.league,
    memberships: ownerOrder.map(owner => {
      const account = accountsByOwner.get(owner) ?? fail("owners", `missing configured owner ${owner}.`);
      const team = teamByOwner.get(owner) ?? fail("owners", `missing configured owner ${owner}.`);

      return {
        accountId: account.id,
        role: owner === mappingDocument.commissionerOwner ? "owner" : "member",
        ownerId: team.ownerId,
        teamId: team.id,
      };
    }),
    season: {
      id: season.id,
      year: season.seasonYear,
      status: season.setupStatus,
      settings: {
        auction: season.settings.auction,
        roster: {
          rosterSize: season.settings.roster.rosterSize,
          lineup: season.settings.roster.lineup,
          rosterMaximums: season.settings.roster.rosterMaximums,
        },
        keeperPolicy: season.settings.keeperPolicy,
      },
      teams: season.teams.map(team => ({
        id: team.id,
        ownerId: team.ownerId,
        ownerDisplayName: team.ownerDisplayName,
        name: team.displayName,
        draftOrderPosition: team.draftOrderPosition,
      })),
    },
    catalog,
    initialRosters: keeperRecords.map(({ keeper, team, player }) => ({
      teamId: team.id,
      playerId: player.playerId,
      price: keeper.newCost,
      source: "keeper",
    })),
    keepers: keeperRecords.map(({ keeper, team, player }) => ({
      id: `keeper-${currentSeasonYear}-${slugFor(keeper.owner)}-${player.playerId.replace(/^player-/, "")}`,
      teamId: team.id,
      playerId: player.playerId,
      keeperCost: keeper.newCost,
      previousCost: keeper.priorCost,
      status: "published",
      source: `checked-in-${keeper.status}`,
    })),
  };
  const content = `${JSON.stringify(rawDocument, null, 2)}\n`;

  parseProductionProvisioningDocument(content);

  return content;
};
