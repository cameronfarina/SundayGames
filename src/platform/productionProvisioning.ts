import { createHash } from "node:crypto";
import type { Position } from "../../config/league.js";
import { normalizeEmail } from "./auth.js";
import type {
  League,
  LeagueSeason,
  LeagueSeasonDraftSchedule,
  LeagueSeasonSettings,
  LineupSettings,
  RosterMaximums,
} from "./leagueSeason.js";
import type { PlatformLeagueMembership } from "./leagueSetup.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "./liveDraftRooms.js";

export const productionProvisioningSchemaVersion = "mockd.production-provisioning/v1";

export interface ProductionProvisioningAccount {
  id: string;
  email: string;
  passwordHashEnv: string;
}

export interface ProductionProvisioningCatalogEntry extends LiveDraftRoomPlayerCatalogEntry {
  playerId: string;
  provider?: string | undefined;
  providerPlayerId?: string | undefined;
}

export interface ProductionProvisioningInitialRosterPlayer extends LiveDraftRoomInitialRosterPlayer {
  playerId: string;
}

export interface ProductionProvisioningKeeper {
  id: string;
  teamId: string;
  playerId: string;
  keeperCost: number;
  previousCost?: number | undefined;
  status: "draft" | "active" | "published" | "removed";
  source: string;
}

export interface ProductionProvisioningDocument {
  schemaVersion: typeof productionProvisioningSchemaVersion;
  provisioningId: string;
  environment: "production";
  actorAccountId: string;
  accounts: readonly ProductionProvisioningAccount[];
  league: League;
  memberships: readonly PlatformLeagueMembership[];
  season: LeagueSeason;
  catalog: readonly ProductionProvisioningCatalogEntry[];
  initialRosters: readonly ProductionProvisioningInitialRosterPlayer[];
  keepers: readonly ProductionProvisioningKeeper[];
}

export type ProductionProvisioningMode = "apply" | "dry-run" | "verify";
export type ProductionProvisioningChangeAction = "create" | "update" | "unchanged";

export interface ProductionProvisioningChange {
  resourceType: string;
  resourceId: string;
  action: ProductionProvisioningChangeAction;
}

export interface ProductionProvisioningInspection {
  changes: readonly ProductionProvisioningChange[];
  conflicts: readonly string[];
  auditRecorded: boolean;
}

export interface ResolvedProductionProvisioningAccount extends ProductionProvisioningAccount {
  passwordHash: string;
}

export interface ResolvedProductionProvisioningDocument extends Omit<ProductionProvisioningDocument, "accounts"> {
  accounts: readonly ResolvedProductionProvisioningAccount[];
}

export interface ProductionProvisioningContext {
  inputDigest: string;
  auditEventId: string;
  now: Date;
}

export interface ProductionProvisioningRepository {
  inspect(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<ProductionProvisioningInspection>;
  apply(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<void>;
  verify(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<readonly string[]>;
}

export interface ExecuteProductionProvisioningOptions {
  mode: ProductionProvisioningMode;
  document: ProductionProvisioningDocument;
  repository: ProductionProvisioningRepository;
  env?: Readonly<Record<string, string | undefined>> | undefined;
  now?: Date | undefined;
}

export interface ProductionProvisioningResult {
  mode: ProductionProvisioningMode;
  status: "planned" | "applied" | "unchanged" | "verified";
  provisioningId: string;
  inputDigest: string;
  auditEventId: string;
  changes: readonly ProductionProvisioningChange[];
}

type JsonObject = Record<string, unknown>;

const positions = ["QB", "RB", "WR", "TE", "K", "DST"] as const satisfies readonly Position[];
const membershipRoles = ["owner", "admin", "member", "observer"] as const;
const leagueProviders = ["mockd", "espn", "sleeper", "yahoo"] as const;
const seasonStatuses = ["draft", "published", "locked"] as const;
const keeperStatuses = ["draft", "active", "published", "removed"] as const;
const localE2eFixturePatterns = [
  /mockd[_-]e2e/i,
  /mockd local e2e/i,
  /@mockd\.local$/i,
] as const;
const passwordHashPattern = /^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/;

const fail = (path: string, message: string): never => {
  throw new Error(`Invalid production provisioning document at ${path}: ${message}`);
};

const objectAt = (value: unknown, path: string): JsonObject => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(path, "expected an object.");
  }

  return value as JsonObject;
};

const arrayAt = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) return fail(path, "expected an array.");

  return value;
};

const stringAt = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(path, "expected a non-empty string.");
  }

  return value.trim();
};

const optionalStringAt = (value: unknown, path: string): string | undefined =>
  value === undefined ? undefined : stringAt(value, path);

const numberAt = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(path, "expected a finite number.");
  }

  return value;
};

const nonNegativeNumberAt = (value: unknown, path: string): number => {
  const parsed = numberAt(value, path);
  if (parsed < 0) return fail(path, "expected a number greater than or equal to 0.");

  return parsed;
};

const positiveNumberAt = (value: unknown, path: string): number => {
  const parsed = numberAt(value, path);
  if (parsed <= 0) return fail(path, "expected a number greater than 0.");

  return parsed;
};

const integerAt = (value: unknown, path: string, minimum = 0): number => {
  const parsed = numberAt(value, path);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fail(path, `expected an integer greater than or equal to ${minimum}.`);
  }

  return parsed;
};

const enumAt = <TValue extends string>(
  value: unknown,
  allowed: readonly TValue[],
  path: string,
): TValue => {
  const parsed = stringAt(value, path);
  const match = allowed.find(candidate => candidate === parsed);
  if (match === undefined) return fail(path, `expected one of ${allowed.join(", ")}.`);

  return match;
};

const optionalIntegerAt = (
  value: unknown,
  path: string,
  minimum = 0,
): number | undefined => value === undefined ? undefined : integerAt(value, path, minimum);

const uniqueBy = <TValue>(
  values: readonly TValue[],
  keyFor: (value: TValue) => string,
  path: string,
): void => {
  const seen = new Set<string>();
  for (const value of values) {
    const key = keyFor(value);
    if (seen.has(key)) fail(path, `contains duplicate value "${key}".`);
    seen.add(key);
  }
};

const assertNoLocalE2eFixtureMarkers = (value: unknown, path = "$"): void => {
  if (typeof value === "string") {
    if (localE2eFixturePatterns.some(pattern => pattern.test(value))) {
      fail(path, "local E2E fixture marker is not allowed in production provisioning.");
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoLocalE2eFixtureMarkers(entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      assertNoLocalE2eFixtureMarkers(entry, `${path}.${key}`);
    }
  }
};

const accountAt = (value: unknown, index: number): ProductionProvisioningAccount => {
  const path = `accounts[${index}]`;
  const record = objectAt(value, path);
  let email: string;
  try {
    email = normalizeEmail(stringAt(record.email, `${path}.email`));
  } catch {
    return fail(`${path}.email`, "expected an email address.");
  }

  const passwordHashEnv = stringAt(record.passwordHashEnv, `${path}.passwordHashEnv`);
  if (!/^[A-Z][A-Z0-9_]*$/.test(passwordHashEnv)) {
    fail(`${path}.passwordHashEnv`, "expected an uppercase environment variable name.");
  }

  return {
    id: stringAt(record.id, `${path}.id`),
    email,
    passwordHashEnv,
  };
};

const leagueAt = (value: unknown): League => {
  const record = objectAt(value, "league");

  return {
    id: stringAt(record.id, "league.id"),
    externalLeagueId: stringAt(record.externalLeagueId, "league.externalLeagueId"),
    name: stringAt(record.name, "league.name"),
    provider: enumAt(record.provider, leagueProviders, "league.provider"),
  };
};

interface ParsedTeam {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  displayName: string;
  draftOrderPosition: number;
}

const teamAt = (value: unknown, index: number): ParsedTeam => {
  const path = `season.teams[${index}]`;
  const record = objectAt(value, path);

  return {
    id: stringAt(record.id, `${path}.id`),
    ownerId: stringAt(record.ownerId, `${path}.ownerId`),
    ownerDisplayName: stringAt(record.ownerDisplayName, `${path}.ownerDisplayName`),
    displayName: stringAt(record.name, `${path}.name`),
    draftOrderPosition: integerAt(record.draftOrderPosition, `${path}.draftOrderPosition`, 1),
  };
};

const lineupAt = (value: unknown): LineupSettings => {
  const record = objectAt(value, "season.settings.roster.lineup");
  const lineup: LineupSettings = {};
  for (const [slot, count] of Object.entries(record)) {
    lineup[slot] = integerAt(count, `season.settings.roster.lineup.${slot}`);
  }
  if (Object.keys(lineup).length === 0) {
    fail("season.settings.roster.lineup", "expected at least one lineup slot.");
  }

  return lineup;
};

const rosterMaximumsAt = (value: unknown): RosterMaximums => {
  const record = objectAt(value, "season.settings.roster.rosterMaximums");

  return {
    QB: integerAt(record.QB, "season.settings.roster.rosterMaximums.QB", 1),
    RB: integerAt(record.RB, "season.settings.roster.rosterMaximums.RB", 1),
    WR: integerAt(record.WR, "season.settings.roster.rosterMaximums.WR", 1),
    TE: integerAt(record.TE, "season.settings.roster.rosterMaximums.TE", 1),
    K: integerAt(record.K, "season.settings.roster.rosterMaximums.K", 1),
    DST: integerAt(record.DST, "season.settings.roster.rosterMaximums.DST", 1),
  };
};

const settingsAt = (value: unknown, teamCount: number): LeagueSeasonSettings => {
  const record = objectAt(value, "season.settings");
  const auction = objectAt(record.auction, "season.settings.auction");
  const roster = objectAt(record.roster, "season.settings.roster");
  const keeperPolicy = objectAt(record.keeperPolicy, "season.settings.keeperPolicy");
  const lineup = lineupAt(roster.lineup);
  const rosterSize = integerAt(roster.rosterSize, "season.settings.roster.rosterSize", 1);
  const lineupSlotCount = Object.values(lineup).reduce((total, count) => total + count, 0);
  if (rosterSize !== lineupSlotCount) {
    fail("season.settings.roster.rosterSize", `expected ${lineupSlotCount} to match lineup slots.`);
  }

  return {
    expectedTeamCount: teamCount,
    auction: {
      budgetDollars: integerAt(auction.budgetDollars, "season.settings.auction.budgetDollars", 1),
      minimumBidDollars: integerAt(auction.minimumBidDollars, "season.settings.auction.minimumBidDollars", 1),
    },
    roster: {
      rosterSize,
      lineup,
      lineupSlotCount,
      rosterMaximums: rosterMaximumsAt(roster.rosterMaximums),
    },
    keeperPolicy: {
      mode: enumAt(
        keeperPolicy.mode,
        ["previous-cost-multiplier"] as const,
        "season.settings.keeperPolicy.mode",
      ),
      multiplier: positiveNumberAt(keeperPolicy.multiplier, "season.settings.keeperPolicy.multiplier"),
      rounding: enumAt(keeperPolicy.rounding, ["ceil"] as const, "season.settings.keeperPolicy.rounding"),
    },
  };
};

const draftAt = (value: unknown): LeagueSeasonDraftSchedule | undefined => {
  if (value === undefined) return undefined;
  const record = objectAt(value, "season.draft");
  const scheduledAt = optionalStringAt(record.scheduledAt, "season.draft.scheduledAt");
  if (scheduledAt !== undefined && Number.isNaN(Date.parse(scheduledAt))) {
    fail("season.draft.scheduledAt", "expected an ISO-8601 timestamp.");
  }

  return {
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
    ...(record.timezone === undefined ? {} : { timezone: stringAt(record.timezone, "season.draft.timezone") }),
  };
};

const seasonAt = (value: unknown, league: League): LeagueSeason => {
  const record = objectAt(value, "season");
  const id = stringAt(record.id, "season.id");
  const parsedTeams = arrayAt(record.teams, "season.teams").map(teamAt);
  if (parsedTeams.length === 0) fail("season.teams", "expected at least one team.");
  uniqueBy(parsedTeams, team => team.id, "season.teams[].id");
  uniqueBy(parsedTeams, team => team.ownerId, "season.teams[].ownerId");
  uniqueBy(parsedTeams, team => String(team.draftOrderPosition), "season.teams[].draftOrderPosition");
  const draft = draftAt(record.draft);

  return {
    id,
    league,
    leagueId: league.id,
    seasonYear: integerAt(record.year, "season.year", 2000),
    setupStatus: enumAt(record.status, seasonStatuses, "season.status"),
    settings: settingsAt(record.settings, parsedTeams.length),
    teams: parsedTeams.map(team => ({ ...team, leagueSeasonId: id })),
    ...(draft === undefined ? {} : { draft }),
  };
};

const membershipAt = (
  value: unknown,
  index: number,
  leagueId: string,
): PlatformLeagueMembership => {
  const path = `memberships[${index}]`;
  const record = objectAt(value, path);

  return {
    userId: stringAt(record.accountId, `${path}.accountId`),
    leagueId,
    role: enumAt(record.role, membershipRoles, `${path}.role`),
    ...(record.ownerId === undefined ? {} : { ownerId: stringAt(record.ownerId, `${path}.ownerId`) }),
    ...(record.teamId === undefined ? {} : { teamId: stringAt(record.teamId, `${path}.teamId`) }),
  };
};

const catalogEntryAt = (value: unknown, index: number): ProductionProvisioningCatalogEntry => {
  const path = `catalog[${index}]`;
  const record = objectAt(value, path);
  const byeWeek = optionalIntegerAt(record.byeWeek, `${path}.byeWeek`, 1);
  if (byeWeek !== undefined && byeWeek > 18) fail(`${path}.byeWeek`, "expected a week from 1 through 18.");

  return {
    playerId: stringAt(record.playerId, `${path}.playerId`),
    name: stringAt(record.name, `${path}.name`),
    position: enumAt(record.position, positions, `${path}.position`),
    expectedPrice: nonNegativeNumberAt(record.expectedPrice, `${path}.expectedPrice`),
    ...(record.provider === undefined ? {} : { provider: stringAt(record.provider, `${path}.provider`) }),
    ...(record.providerPlayerId === undefined
      ? {}
      : { providerPlayerId: stringAt(record.providerPlayerId, `${path}.providerPlayerId`) }),
    ...(record.teamAbbreviation === undefined
      ? {}
      : { teamAbbreviation: stringAt(record.teamAbbreviation, `${path}.teamAbbreviation`) }),
    ...(byeWeek === undefined ? {} : { byeWeek }),
  };
};

const initialRosterAt = (
  value: unknown,
  index: number,
  catalogById: ReadonlyMap<string, ProductionProvisioningCatalogEntry>,
): ProductionProvisioningInitialRosterPlayer => {
  const path = `initialRosters[${index}]`;
  const record = objectAt(value, path);
  const playerId = stringAt(record.playerId, `${path}.playerId`);
  const player = catalogById.get(playerId);
  if (player === undefined) {
    return fail(`${path}.playerId`, `references missing catalog player "${playerId}".`);
  }

  return {
    teamId: stringAt(record.teamId, `${path}.teamId`),
    playerId,
    playerName: player.name,
    position: player.position,
    price: integerAt(record.price, `${path}.price`),
    expectedPrice: player.expectedPrice,
    source: enumAt(record.source, ["keeper", "imported"] as const, `${path}.source`),
  };
};

const keeperAt = (value: unknown, index: number): ProductionProvisioningKeeper => {
  const path = `keepers[${index}]`;
  const record = objectAt(value, path);

  return {
    id: stringAt(record.id, `${path}.id`),
    teamId: stringAt(record.teamId, `${path}.teamId`),
    playerId: stringAt(record.playerId, `${path}.playerId`),
    keeperCost: integerAt(record.keeperCost, `${path}.keeperCost`),
    ...(record.previousCost === undefined
      ? {}
      : { previousCost: integerAt(record.previousCost, `${path}.previousCost`) }),
    status: enumAt(record.status, keeperStatuses, `${path}.status`),
    source: stringAt(record.source, `${path}.source`),
  };
};

const assertReferences = (document: ProductionProvisioningDocument): void => {
  const accountIds = new Set(document.accounts.map(account => account.id));
  if (!accountIds.has(document.actorAccountId)) {
    fail("actorAccountId", "must reference an account in this document.");
  }

  const teamById = new Map(document.season.teams.map(team => [team.id, team]));
  const catalogIds = new Set(document.catalog.map(player => player.playerId));
  for (const [index, membership] of document.memberships.entries()) {
    if (!accountIds.has(membership.userId)) {
      fail(`memberships[${index}].accountId`, `references missing account "${membership.userId}".`);
    }
    if ((membership.ownerId === undefined) !== (membership.teamId === undefined)) {
      fail(`memberships[${index}]`, "ownerId and teamId must be provided together.");
    }
    if (membership.teamId !== undefined) {
      const team = teamById.get(membership.teamId);
      if (team === undefined || team.ownerId !== membership.ownerId) {
        fail(`memberships[${index}].teamId`, "must reference the matching season team and owner.");
      }
    }
  }

  const actorMembership = document.memberships.find(membership => membership.userId === document.actorAccountId);
  if (actorMembership === undefined || (actorMembership.role !== "owner" && actorMembership.role !== "admin")) {
    fail("actorAccountId", "must reference an owner or admin membership.");
  }

  for (const [index, rosterPlayer] of document.initialRosters.entries()) {
    if (!teamById.has(rosterPlayer.teamId)) {
      fail(`initialRosters[${index}].teamId`, `references missing team "${rosterPlayer.teamId}".`);
    }
  }
  for (const [index, keeper] of document.keepers.entries()) {
    if (!teamById.has(keeper.teamId)) {
      fail(`keepers[${index}].teamId`, `references missing team "${keeper.teamId}".`);
    }
    if (!catalogIds.has(keeper.playerId)) {
      fail(`keepers[${index}].playerId`, `references missing catalog player "${keeper.playerId}".`);
    }
    const rosterKeeper = document.initialRosters.find(player =>
      player.teamId === keeper.teamId &&
      player.playerId === keeper.playerId &&
      player.source === "keeper" &&
      player.price === keeper.keeperCost
    );
    if (keeper.status !== "removed" && rosterKeeper === undefined) {
      fail(`keepers[${index}]`, "must match a keeper entry in initialRosters.");
    }
  }
};

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
};

const resolveDocument = (
  document: ProductionProvisioningDocument,
  env: Readonly<Record<string, string | undefined>>,
): ResolvedProductionProvisioningDocument => ({
  ...document,
  accounts: document.accounts.map(account => {
    const passwordHash = env[account.passwordHashEnv]?.trim();
    if (passwordHash === undefined || passwordHash.length === 0) {
      throw new Error(`${account.passwordHashEnv} is required for production provisioning.`);
    }
    if (!passwordHashPattern.test(passwordHash)) {
      throw new Error(`${account.passwordHashEnv} must contain a Mockd scrypt password hash.`);
    }

    return { ...account, passwordHash };
  }),
});

const digestFor = (
  document: ResolvedProductionProvisioningDocument,
): string => sha256(canonicalJson({
  document: {
    ...document,
    accounts: document.accounts.map(({ passwordHash: _passwordHash, ...account }) => account),
  },
  credentialDigests: document.accounts.map(account => ({
    accountId: account.id,
    passwordHashDigest: sha256(account.passwordHash),
  })),
}));

export const executeProductionProvisioning = async (
  options: ExecuteProductionProvisioningOptions,
): Promise<ProductionProvisioningResult> => {
  const document = resolveDocument(options.document, options.env ?? process.env);
  const inputDigest = digestFor(document);
  const context: ProductionProvisioningContext = {
    inputDigest,
    auditEventId: `production-provisioning:${document.provisioningId}:${inputDigest}`,
    now: options.now ?? new Date(),
  };
  const inspection = await options.repository.inspect(document, context);
  if (inspection.conflicts.length > 0) {
    throw new Error(`Production provisioning conflicts:\n- ${inspection.conflicts.join("\n- ")}`);
  }
  if (
    inspection.auditRecorded &&
    inspection.changes.some(change => change.action !== "unchanged")
  ) {
    throw new Error(
      `Production provisioning audit receipt exists, but state differs for ${document.provisioningId}. Run --verify and investigate the drift.`,
    );
  }
  if (options.mode === "apply") {
    const alreadyApplied = inspection.auditRecorded &&
      inspection.changes.every(change => change.action === "unchanged");
    if (!alreadyApplied) {
      await options.repository.apply(document, context);
      const issues = await options.repository.verify(document, context);
      if (issues.length > 0) {
        throw new Error(`Production provisioning verification failed after apply:\n- ${issues.join("\n- ")}`);
      }
    }

    return {
      mode: options.mode,
      status: alreadyApplied ? "unchanged" : "applied",
      provisioningId: document.provisioningId,
      inputDigest,
      auditEventId: context.auditEventId,
      changes: inspection.changes,
    };
  }
  if (options.mode === "verify") {
    const issues = [
      ...inspection.changes
        .filter(change => change.action !== "unchanged")
        .map(change => `${change.resourceType} ${change.resourceId} requires ${change.action}.`),
      ...(inspection.auditRecorded ? [] : [`Audit event ${context.auditEventId} is missing.`]),
      ...await options.repository.verify(document, context),
    ];
    if (issues.length > 0) {
      throw new Error(`Production provisioning verification failed:\n- ${issues.join("\n- ")}`);
    }

    return {
      mode: options.mode,
      status: "verified",
      provisioningId: document.provisioningId,
      inputDigest,
      auditEventId: context.auditEventId,
      changes: inspection.changes,
    };
  }

  return {
    mode: options.mode,
    status: "planned",
    provisioningId: document.provisioningId,
    inputDigest,
    auditEventId: context.auditEventId,
    changes: inspection.changes,
  };
};

export const parseProductionProvisioningDocument = (
  content: string,
): ProductionProvisioningDocument => {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return fail("$", "expected valid JSON.");
  }

  assertNoLocalE2eFixtureMarkers(value);

  const record = objectAt(value, "$");
  const schemaVersion = enumAt(
    record.schemaVersion,
    [productionProvisioningSchemaVersion] as const,
    "schemaVersion",
  );
  const environment = enumAt(record.environment, ["production"] as const, "environment");

  const accounts = arrayAt(record.accounts, "accounts").map(accountAt);
  if (accounts.length === 0) fail("accounts", "expected at least one account.");
  uniqueBy(accounts, account => account.id, "accounts[].id");
  uniqueBy(accounts, account => account.email, "accounts[].email");

  const league = leagueAt(record.league);
  const season = seasonAt(record.season, league);
  const memberships = arrayAt(record.memberships, "memberships")
    .map((membership, index) => membershipAt(membership, index, league.id));
  if (memberships.length === 0) fail("memberships", "expected at least one membership.");
  uniqueBy(memberships, membership => membership.userId, "memberships[].accountId");

  const catalog = arrayAt(record.catalog, "catalog").map(catalogEntryAt);
  if (catalog.length === 0) fail("catalog", "expected at least one player.");
  uniqueBy(catalog, player => player.playerId, "catalog[].playerId");
  const catalogById = new Map(catalog.map(player => [player.playerId, player]));
  const initialRosters = arrayAt(record.initialRosters, "initialRosters")
    .map((player, index) => initialRosterAt(player, index, catalogById));
  uniqueBy(initialRosters, player => player.playerId, "initialRosters[].playerId");
  const keepers = arrayAt(record.keepers, "keepers").map(keeperAt);
  uniqueBy(keepers, keeper => keeper.id, "keepers[].id");
  uniqueBy(
    keepers.filter(keeper => keeper.status !== "removed"),
    keeper => keeper.playerId,
    "keepers[].playerId",
  );

  const document: ProductionProvisioningDocument = {
    schemaVersion,
    provisioningId: stringAt(record.provisioningId, "provisioningId"),
    environment,
    actorAccountId: stringAt(record.actorAccountId, "actorAccountId"),
    accounts,
    league,
    memberships,
    season,
    catalog,
    initialRosters,
    keepers,
  };
  assertReferences(document);

  return document;
};
