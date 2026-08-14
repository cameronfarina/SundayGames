import { pathToFileURL } from "node:url";
import { leagueConfig, ownerOrder } from "../../config/league.js";
import {
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  verifyPassword,
  type AccountRecord,
  type SessionRecord,
} from "./auth.js";
import { createDisabledSimulationRunner } from "./currentLeagueSimulationRunner.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "./leagueSeason.js";
import type {
  LiveDraftRoom,
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "./liveDraftRooms.js";
import {
  currentLeagueInitialRostersFor,
  localDemoEmail,
  loadLocalDemoPlayerCatalog,
  localDemoPassword,
  localDemoRoomId,
  localDemoSeasonId,
} from "./localDemoFixtures.js";
import { createNodePostgresClient, type NodePostgresClient } from "./postgresClient.js";
import {
  createPlatformApp,
  type PlatformLeagueMembership,
} from "./platformApp.js";
import { readPlatformRuntimeConfig } from "./platformRuntimeConfig.js";
import { createPlatformServer } from "./platformServer.js";

export interface LocalE2eSeedEnv {
  readonly [key: string]: string | undefined;
}

export type LocalE2eSeedStorage =
  | { kind: "file"; path: string }
  | { kind: "postgres"; databaseUrl: string; snapshotKey?: string | undefined };

export type LocalE2eSeedPlatformApp = ReturnType<typeof createPlatformApp>;

export interface LocalE2eSeedRuntime {
  storage: LocalE2eSeedStorage;
  app: LocalE2eSeedPlatformApp;
  persist: () => Promise<void>;
  close: () => Promise<void>;
}

export interface SeedLocalE2eOptions {
  now?: Date | undefined;
  playerCatalog?: readonly LiveDraftRoomPlayerCatalogEntry[] | undefined;
  initialRosters?: readonly LiveDraftRoomInitialRosterPlayer[] | undefined;
  persist?: (() => Promise<void>) | undefined;
}

export interface SeedLocalE2eAccount {
  accountId: string;
  email: string;
  password: string;
  sessionToken: string;
}

export interface SeedLocalE2eTeamClaim {
  userId: string;
  leagueId: string;
  role: PlatformLeagueMembership["role"];
  ownerId: string;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
}

export interface SeedLocalE2eSeasonSummary {
  id: string;
  leagueId: string;
  seasonYear: number;
  teamCount: number;
  setupStatus: LeagueSeason["setupStatus"];
}

export interface SeedLocalE2eRoomSummary {
  roomId: string;
  status: LiveDraftRoom["status"];
  revision: number;
  boardCount: number;
  catalogCount: number;
  initialRosterCount: number;
}

export interface SeedLocalE2eOpenTeam {
  ownerDisplayName: string;
  teamDisplayName: string;
}

export interface SeedLocalE2eResult {
  storage?: LocalE2eSeedStorage | undefined;
  accounts: {
    commissioner: SeedLocalE2eAccount;
    manager: SeedLocalE2eAccount;
  };
  season: SeedLocalE2eSeasonSummary;
  teamClaims: {
    commissioner: SeedLocalE2eTeamClaim;
    manager: SeedLocalE2eTeamClaim;
  };
  openTeams: readonly SeedLocalE2eOpenTeam[];
  liveDraftRoom: SeedLocalE2eRoomSummary;
}

const seedSessionExpiresAt = new Date("2100-01-01T00:00:00.000Z");
const seedAccountFixtures = {
  commissioner: {
    id: "acct_mockd_e2e_commissioner",
    email: localDemoEmail,
    sessionId: "sess_mockd_e2e_commissioner",
    sessionToken: "mockd-local-e2e-commissioner-session-token",
  },
  manager: {
    id: "acct_mockd_e2e_manager",
    email: "manager@mockd.local",
    sessionId: "sess_mockd_e2e_manager",
    sessionToken: "mockd-local-e2e-manager-session-token",
  },
};

const commissionerOwner = ownerOrder[10] ?? "Owner11";
const managerOwner = ownerOrder[3] ?? "Owner04";

const optionalEnvString = (
  env: LocalE2eSeedEnv,
  key: string,
): string | undefined => {
  const value = env[key]?.trim();

  return value === undefined || value.length === 0 ? undefined : value;
};

const dateOrDefault = (date: Date | undefined): Date =>
  date === undefined ? new Date() : date;

const teamByOwner = (
  season: LeagueSeason,
  ownerDisplayName: string,
): LeagueSeason["teams"][number] => {
  const team = season.teams.find(candidate => candidate.ownerDisplayName === ownerDisplayName);
  if (team === undefined) throw new Error(`Expected ${ownerDisplayName} team in local E2E seed.`);

  return team;
};

const ensureSeedAccount = async (
  app: LocalE2eSeedPlatformApp,
  fixture: typeof seedAccountFixtures[keyof typeof seedAccountFixtures],
  now: Date,
): Promise<AccountRecord> => {
  const email = normalizeEmail(fixture.email);
  const existingCredential = await app.authRepository.findAccountCredentialByEmail(email);

  if (existingCredential !== null) {
    if (!verifyPassword(localDemoPassword, existingCredential.passwordHash)) {
      throw new Error(`Existing account ${email} does not match the local E2E seed password.`);
    }

    return existingCredential.account;
  }

  return await app.authRepository.createAccount({
    id: fixture.id,
    email,
    passwordHash: hashPassword(localDemoPassword),
    now,
  });
};

const ensureSeedSession = async (
  app: LocalE2eSeedPlatformApp,
  account: AccountRecord,
  fixture: typeof seedAccountFixtures[keyof typeof seedAccountFixtures],
  now: Date,
): Promise<SessionRecord> => {
  const tokenHash = hashSessionToken(fixture.sessionToken);
  const existingSession = await app.authRepository.findSessionById(fixture.sessionId);
  if (existingSession !== null) {
    if (existingSession.accountId !== account.id || existingSession.tokenHash !== tokenHash) {
      throw new Error(`Existing session ${fixture.sessionId} does not match the local E2E seed account.`);
    }
    if (existingSession.revokedAt === undefined && existingSession.expiresAt > now) {
      return existingSession;
    }

    throw new Error(`Existing session ${fixture.sessionId} is expired or revoked.`);
  }

  return await app.authRepository.createSession({
    id: fixture.sessionId,
    accountId: account.id,
    tokenHash,
    createdAt: now,
    expiresAt: seedSessionExpiresAt,
  });
};

const seedAccount = async (
  app: LocalE2eSeedPlatformApp,
  fixture: typeof seedAccountFixtures[keyof typeof seedAccountFixtures],
  now: Date,
): Promise<SeedLocalE2eAccount> => {
  const account = await ensureSeedAccount(app, fixture, now);
  await ensureSeedSession(app, account, fixture, now);

  return {
    accountId: account.id,
    email: account.email,
    password: localDemoPassword,
    sessionToken: fixture.sessionToken,
  };
};

const membershipFor = (
  account: SeedLocalE2eAccount,
  season: LeagueSeason,
  ownerDisplayName: string,
): PlatformLeagueMembership => {
  const team = teamByOwner(season, ownerDisplayName);

  return {
    userId: account.accountId,
    leagueId: season.leagueId,
    role: ownerDisplayName === commissionerOwner ? "owner" : "member",
    ownerId: team.ownerId,
    teamId: team.id,
  };
};

const findSeedRoom = async (
  app: LocalE2eSeedPlatformApp,
  commissionerSessionToken: string,
): Promise<LiveDraftRoom | null> => {
  try {
    return await app.getLiveDraftRoom({
      actorSessionToken: commissionerSessionToken,
      roomId: localDemoRoomId,
    });
  } catch (error) {
    const code = error !== null && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
    if (code === "room_not_found") return null;

    throw error;
  }
};

const ensureSeedRoom = async (
  app: LocalE2eSeedPlatformApp,
  season: LeagueSeason,
  commissioner: SeedLocalE2eAccount,
  options: Pick<SeedLocalE2eOptions, "initialRosters" | "playerCatalog">,
  now: Date,
): Promise<LiveDraftRoom> => {
  const existingRoom = await findSeedRoom(app, commissioner.sessionToken);
  if (existingRoom !== null) {
    if (existingRoom.status === "ended") {
      throw new Error(`Local E2E room ${localDemoRoomId} has ended. Remove it before reseeding.`);
    }

    if (existingRoom.status === "live") return existingRoom;

    return await app.startLiveDraftRoom({
      actorSessionToken: commissioner.sessionToken,
      roomId: existingRoom.roomId,
      expectedRevision: existingRoom.revision,
      idempotencyKey: `${localDemoRoomId}:start`,
      now,
    });
  }

  const createdRoom = await app.createLiveDraftRoom({
    actorSessionToken: commissioner.sessionToken,
    seasonId: season.id,
    roomId: localDemoRoomId,
    viewerPasswordHashRef: "local-e2e-viewer-password",
    playerCatalog: options.playerCatalog ?? await loadLocalDemoPlayerCatalog(),
    initialRosters: options.initialRosters ?? currentLeagueInitialRostersFor(season),
    now,
  });

  return await app.startLiveDraftRoom({
    actorSessionToken: commissioner.sessionToken,
    roomId: createdRoom.roomId,
    expectedRevision: createdRoom.revision,
    idempotencyKey: `${localDemoRoomId}:start`,
    now: new Date(now.getTime() + 1_000),
  });
};

const seasonSummaryFor = (season: LeagueSeason): SeedLocalE2eSeasonSummary => ({
  id: season.id,
  leagueId: season.leagueId,
  seasonYear: season.seasonYear,
  teamCount: season.teams.length,
  setupStatus: season.setupStatus,
});

const teamClaimFor = (
  season: LeagueSeason,
  ownerDisplayName: string,
  membership: PlatformLeagueMembership,
): SeedLocalE2eTeamClaim => {
  const team = teamByOwner(season, ownerDisplayName);

  return {
    userId: membership.userId,
    leagueId: membership.leagueId,
    role: membership.role,
    ownerId: membership.ownerId ?? team.ownerId,
    teamId: membership.teamId ?? team.id,
    ownerDisplayName: team.ownerDisplayName,
    teamDisplayName: team.displayName,
  };
};

const roomSummaryFor = (room: LiveDraftRoom): SeedLocalE2eRoomSummary => ({
  roomId: room.roomId,
  status: room.status,
  revision: room.revision,
  boardCount: room.projection.board.length,
  catalogCount: room.playerCatalog.length,
  initialRosterCount: room.initialRosters.length,
});

const openTeamsFor = (season: LeagueSeason): readonly SeedLocalE2eOpenTeam[] =>
  season.teams
    .filter(team => team.ownerDisplayName !== commissionerOwner && team.ownerDisplayName !== managerOwner)
    .map(team => ({
      ownerDisplayName: team.ownerDisplayName,
      teamDisplayName: team.displayName,
    }));

export const loadLocalE2eSeedRuntime = async (
  env: LocalE2eSeedEnv = process.env,
): Promise<LocalE2eSeedRuntime> => {
  const config = readPlatformRuntimeConfig(env, { requireDurableStore: true });
  const postgresClient: NodePostgresClient | undefined = config.databaseUrl === undefined
    ? undefined
    : createNodePostgresClient({
      databaseUrl: config.databaseUrl,
      max: config.postgresPoolSize,
      statementTimeoutMs: config.postgresStatementTimeoutMs,
    });
  const server = await createPlatformServer({
    dataFilePath: config.dataFilePath,
    postgresClient,
    postgresAuthClient: postgresClient,
    postgresLeagueSetupClient: postgresClient,
    postgresHistoricalImportClient: postgresClient,
    postgresJobClient: postgresClient,
    postgresSimulationClient: postgresClient,
    postgresSnapshotKey: config.postgresSnapshotKey,
    initializePostgresSchema: config.initializePostgresSchema,
    simulationRunner: createDisabledSimulationRunner(),
  });
  const storage: LocalE2eSeedStorage = config.databaseUrl === undefined
    ? { kind: "file", path: config.dataFilePath ?? "" }
    : {
      kind: "postgres",
      databaseUrl: config.databaseUrl,
      ...(config.postgresSnapshotKey === undefined ? {} : { snapshotKey: config.postgresSnapshotKey }),
    };
  let closed = false;

  return {
    storage,
    app: server.app,
    persist: server.persist,
    close: async () => {
      if (closed) return;
      closed = true;
      await server.close();
      await postgresClient?.close();
    },
  };
};

export const seedLocalE2e = async (
  app: LocalE2eSeedPlatformApp,
  options: SeedLocalE2eOptions = {},
): Promise<SeedLocalE2eResult> => {
  const draftSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "Mockd Local E2E",
    setupStatus: "published",
  });
  if (draftSeason.id !== localDemoSeasonId) {
    throw new Error(
      `Local E2E season ${draftSeason.id} does not match the configured demo season ${localDemoSeasonId}.`,
    );
  }
  const now = dateOrDefault(options.now);
  const commissioner = await seedAccount(app, seedAccountFixtures.commissioner, now);
  const manager = await seedAccount(app, seedAccountFixtures.manager, now);
  const season = await app.registerLeagueSeason({
    actorSessionToken: commissioner.sessionToken,
    season: draftSeason,
    memberships: [
      membershipFor(commissioner, draftSeason, commissionerOwner),
      membershipFor(manager, draftSeason, managerOwner),
    ],
    now,
  });
  const commissionerTeam = teamByOwner(season, commissionerOwner);
  const managerTeam = teamByOwner(season, managerOwner);
  const commissionerClaim = await app.claimLeagueSeasonTeam({
    actorSessionToken: commissioner.sessionToken,
    seasonId: season.id,
    ownerId: commissionerTeam.ownerId,
    teamId: commissionerTeam.id,
    now,
  });
  const managerClaim = await app.claimLeagueSeasonTeam({
    actorSessionToken: manager.sessionToken,
    seasonId: season.id,
    ownerId: managerTeam.ownerId,
    teamId: managerTeam.id,
    now,
  });
  const liveDraftRoom = await ensureSeedRoom(app, season, commissioner, options, now);
  await options.persist?.();

  return {
    accounts: { commissioner, manager },
    season: seasonSummaryFor(season),
    teamClaims: {
      commissioner: teamClaimFor(season, commissionerOwner, commissionerClaim),
      manager: teamClaimFor(season, managerOwner, managerClaim),
    },
    openTeams: openTeamsFor(season),
    liveDraftRoom: roomSummaryFor(liveDraftRoom),
  };
};

export const seedLocalE2eFromEnv = async (
  env: LocalE2eSeedEnv = process.env,
  options: SeedLocalE2eOptions = {},
): Promise<SeedLocalE2eResult> => {
  const runtime = await loadLocalE2eSeedRuntime(env);

  try {
    const result = await seedLocalE2e(runtime.app, {
      ...options,
      persist: runtime.persist,
    });

    return {
      ...result,
      storage: runtime.storage,
    };
  } finally {
    await runtime.close();
  }
};

const storageLabel = (storage: LocalE2eSeedStorage | undefined): string => {
  if (storage === undefined) return "custom app runtime";
  if (storage.kind === "file") return storage.path;

  return storage.snapshotKey === undefined
    ? "Postgres"
    : `Postgres snapshot ${storage.snapshotKey}`;
};

const formatHumanResult = (result: SeedLocalE2eResult): string => [
  "Mockd local E2E seed ready.",
  `Storage: ${storageLabel(result.storage)}`,
  `Season: ${result.season.id} (${result.season.teamCount} teams)`,
  `Live room: ${result.liveDraftRoom.roomId} (${result.liveDraftRoom.status}, revision ${result.liveDraftRoom.revision})`,
  `Commissioner login: ${result.accounts.commissioner.email} / ${result.accounts.commissioner.password}`,
  `Manager login: ${result.accounts.manager.email} / ${result.accounts.manager.password}`,
  `Unclaimed teams: ${result.openTeams.length}`,
].join("\n");

const run = async (): Promise<void> => {
  const result = await seedLocalE2eFromEnv();

  console.log(process.argv.includes("--json") ? JSON.stringify(result, null, 2) : formatHumanResult(result));
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
