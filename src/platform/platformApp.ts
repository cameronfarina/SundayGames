import {
  InMemoryAuthRepository,
  createAuthService,
  type AccountCredentialRecord,
  type AccountRecord,
  type CreateUserInput,
  type LoginInput,
  type LoginResult,
  type SessionRecord,
} from "./auth.js";
import {
  draftExportSlotOrder,
  generateDraftExport,
  type DraftExportResult,
  type DraftExportRosterSlotKey,
  type DraftExportTeamState,
} from "./draftExport.js";
import type { LeagueSeason } from "./leagueSeason.js";
import {
  InMemoryLiveDraftRoomRepository,
  type CreateLiveDraftRoomInput,
  type LiveDraftRoom,
  type LiveDraftRoomActor,
  type LiveDraftRoomInitialRosterPlayer,
  type LiveDraftRoomPlayerCatalogEntry,
  type LiveDraftRoomSaleCommandInput,
} from "./liveDraftRooms.js";
import {
  InMemoryMockDraftSessionRepository,
  type AppendMockDraftCommandInput,
  type MockDraftSession,
  type MockDraftModeMetadata,
} from "./mockSessions.js";
import {
  InMemorySimulationRepository,
  executeSimulationRun,
  type CreateSimulationRequestInput,
  type SimulationMockBatchRunner,
  type SimulationRun,
} from "./simulations.js";
import {
  authorizeSharedLeagueResourceRead,
  authorizeSharedLeagueSetupMutation,
  type LeagueMembership,
  type WorkspaceRole,
} from "./workspacePrivacy.js";

export type PlatformAppErrorCode =
  | "auth_required"
  | "league_not_found"
  | "membership_required"
  | "private_resource"
  | "private_team_required"
  | "season_not_found"
  | "shared_mutation_denied"
  | "team_claim_required"
  | "team_not_found";

export class PlatformAppError extends Error {
  readonly code: PlatformAppErrorCode;

  constructor(code: PlatformAppErrorCode, message: string) {
    super(message);
    this.name = "PlatformAppError";
    this.code = code;
  }
}

export interface PlatformLeagueMembership extends LeagueMembership {
  ownerId?: string;
  teamId?: string;
  inviteEmail?: string;
}

export interface RegisterLeagueSeasonInput {
  actorSessionToken: string;
  season: LeagueSeason;
  memberships: readonly PlatformLeagueMembership[];
  now?: Date | undefined;
}

export interface GetLeagueSeasonInput {
  actorSessionToken: string;
  seasonId: string;
  now?: Date | undefined;
}

export interface PrivateTeamContextInput {
  actorSessionToken: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  now?: Date | undefined;
}

export interface CreatePlatformSimulationRunInput extends Omit<
  CreateSimulationRequestInput,
  "userId" | "createdAt"
> {
  actorSessionToken: string;
  now?: Date | undefined;
}

export interface ExecutePlatformSimulationRunInput {
  actorSessionToken: string;
  runId: string;
  now?: Date | undefined;
}

export interface ExecutePlatformSimulationRunForWorkerInput {
  runId: string;
  userId: string;
  leagueId: string;
  seasonId: string;
  now?: Date | undefined;
}

export interface ListPlatformSimulationRunsInput {
  actorSessionToken: string;
  now?: Date | undefined;
}

export interface GetPlatformSimulationRunInput {
  actorSessionToken: string;
  runId: string;
  now?: Date | undefined;
}

export interface CreatePlatformMockDraftSessionInput extends PrivateTeamContextInput {
  draftMode: MockDraftModeMetadata;
  status?: "setup" | "active" | undefined;
}

export interface ListPlatformMockDraftSessionsInput {
  actorSessionToken: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId?: string | undefined;
  now?: Date | undefined;
}

export interface AppendPlatformMockDraftCommandInput extends Omit<AppendMockDraftCommandInput, "userId" | "now"> {
  actorSessionToken: string;
  now?: Date | undefined;
}

export interface ResetPlatformMockDraftSessionInput {
  actorSessionToken: string;
  sessionId: string;
  expectedRevision: number;
  now?: Date | undefined;
}

export interface CreatePlatformLiveDraftRoomInput extends Omit<
  CreateLiveDraftRoomInput,
  "season" | "commissionerUserId" | "createdAt"
> {
  actorSessionToken: string;
  seasonId: string;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  initialRosters?: readonly LiveDraftRoomInitialRosterPlayer[] | undefined;
  now?: Date | undefined;
}

export interface GetPlatformLiveDraftRoomInput {
  actorSessionToken: string;
  roomId: string;
  now?: Date | undefined;
}

export interface MutatePlatformLiveDraftRoomInput {
  actorSessionToken: string;
  roomId: string;
  expectedRevision?: number | undefined;
  idempotencyKey?: string | undefined;
  now?: Date | undefined;
}

export interface LogPlatformLiveDraftSaleInput extends MutatePlatformLiveDraftRoomInput {
  sale: LiveDraftRoomSaleCommandInput;
}

export interface ExportPlatformLiveDraftRoomInput {
  actorSessionToken: string;
  roomId: string;
  exportedAt: Date;
  now?: Date | undefined;
}

export interface PlatformAppOptions {
  store?: InMemoryPlatformStore | undefined;
  simulationRunner: SimulationMockBatchRunner;
}

export interface InMemoryPlatformStoreSnapshot {
  auth: {
    accountCredentials: readonly AccountCredentialRecord[];
    sessions: readonly SessionRecord[];
  };
  leagueSeasons: readonly LeagueSeason[];
  memberships: readonly PlatformLeagueMembership[];
  mockDraftSessions: readonly MockDraftSession[];
  simulationRuns: readonly SimulationRun[];
  liveDraftRooms: readonly LiveDraftRoom[];
}

const draftExportSlotKeys = new Set<string>(draftExportSlotOrder);
const sharedMutationRoles = new Set<WorkspaceRole>(["owner", "admin"]);

const membershipKeyFor = (userId: string, leagueId: string): string => `${userId}\0${leagueId}`;

const cloneForRead = <T>(value: T): T => structuredClone(value);

const isExportSlotKey = (slot: string): slot is DraftExportRosterSlotKey => draftExportSlotKeys.has(slot);

export class InMemoryPlatformStore {
  readonly authRepository = new InMemoryAuthRepository();
  readonly mockDraftSessions = new InMemoryMockDraftSessionRepository();
  readonly simulations = new InMemorySimulationRepository();
  readonly liveDraftRooms: InMemoryLiveDraftRoomRepository;
  readonly #leagueSeasonsById = new Map<string, LeagueSeason>();
  readonly #membershipsByUserAndLeague = new Map<string, PlatformLeagueMembership>();

  constructor(snapshot?: InMemoryPlatformStoreSnapshot | undefined) {
    this.liveDraftRooms = new InMemoryLiveDraftRoomRepository(({ actor, action, room }) => {
      const membership = this.findMembership(actor.userId, room.leagueId);

      if (actor.leagueId !== room.leagueId || membership === null) return false;
      if (action === "read") return true;

      return sharedMutationRoles.has(membership.role);
    });

    if (snapshot !== undefined) {
      this.#loadSnapshot(snapshot);
    }
  }

  registerLeagueSeason(
    season: LeagueSeason,
    memberships: readonly PlatformLeagueMembership[],
  ): LeagueSeason {
    const storedSeason = cloneForRead(season);

    this.#leagueSeasonsById.set(storedSeason.id, storedSeason);

    for (const [membershipKey, membership] of this.#membershipsByUserAndLeague) {
      if (membership.leagueId === storedSeason.leagueId) {
        this.#membershipsByUserAndLeague.delete(membershipKey);
      }
    }

    for (const membership of memberships) {
      this.#membershipsByUserAndLeague.set(membershipKeyFor(membership.userId, membership.leagueId), {
        ...cloneForRead(membership),
      });
    }

    return cloneForRead(storedSeason);
  }

  findLeagueSeason(seasonId: string): LeagueSeason | null {
    const season = this.#leagueSeasonsById.get(seasonId);

    return season === undefined ? null : cloneForRead(season);
  }

  hasLeagueSeasonForLeague(leagueId: string): boolean {
    return [...this.#leagueSeasonsById.values()]
      .some(season => season.leagueId === leagueId);
  }

  findMembership(userId: string, leagueId: string): PlatformLeagueMembership | null {
    const membership = this.#membershipsByUserAndLeague.get(membershipKeyFor(userId, leagueId));

    return membership === undefined ? null : cloneForRead(membership);
  }

  membershipsForLeague(leagueId: string): readonly PlatformLeagueMembership[] {
    return [...this.#membershipsByUserAndLeague.values()]
      .filter(membership => membership.leagueId === leagueId)
      .map(membership => cloneForRead(membership));
  }

  snapshot(): InMemoryPlatformStoreSnapshot {
    return {
      auth: {
        accountCredentials: this.authRepository.accounts().map(account => {
          const credential = this.authRepository.findAccountCredentialByEmail(account.email);
          if (credential === null) {
            throw new Error(`Missing credential for account "${account.id}".`);
          }

          return cloneForRead(credential);
        }),
        sessions: this.authRepository.sessions().map(session => cloneForRead(session)),
      },
      leagueSeasons: [...this.#leagueSeasonsById.values()].map(season => cloneForRead(season)),
      memberships: [...this.#membershipsByUserAndLeague.values()].map(membership => cloneForRead(membership)),
      mockDraftSessions: this.mockDraftSessions.sessions(),
      simulationRuns: this.simulations.runs(),
      liveDraftRooms: this.liveDraftRooms.rooms(),
    };
  }

  #loadSnapshot(snapshot: InMemoryPlatformStoreSnapshot): void {
    this.#leagueSeasonsById.clear();
    this.#membershipsByUserAndLeague.clear();

    for (const credential of snapshot.auth.accountCredentials) {
      const account = this.authRepository.createAccount({
        id: credential.account.id,
        email: credential.account.email,
        passwordHash: credential.passwordHash,
        now: credential.account.createdAt,
      });

      account.updatedAt = credential.account.updatedAt;
    }

    for (const session of snapshot.auth.sessions) {
      this.authRepository.createSession({
        id: session.id,
        accountId: session.accountId,
        tokenHash: session.tokenHash,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      });

      if (session.revokedAt !== undefined) {
        this.authRepository.revokeSession(session.id, session.revokedAt);
      }
    }

    for (const season of snapshot.leagueSeasons) {
      const storedSeason = cloneForRead(season);
      this.#leagueSeasonsById.set(storedSeason.id, storedSeason);
    }

    for (const membership of snapshot.memberships) {
      this.#membershipsByUserAndLeague.set(
        membershipKeyFor(membership.userId, membership.leagueId),
        cloneForRead(membership),
      );
    }

    this.liveDraftRooms.replaceRooms(snapshot.liveDraftRooms);
    this.mockDraftSessions.replaceSessions(snapshot.mockDraftSessions ?? []);
    this.simulations.replaceRuns(snapshot.simulationRuns ?? []);
  }
}

export const createPlatformApp = ({
  store = new InMemoryPlatformStore(),
  simulationRunner,
}: PlatformAppOptions) => {
  const auth = createAuthService({ repository: store.authRepository });

  const requireAccount = (sessionToken: string, now?: Date): AccountRecord => {
    const authenticated = auth.lookupSession(sessionToken, now);

    if (authenticated === null) {
      throw new PlatformAppError("auth_required", "Sign in before using this workspace.");
    }

    return authenticated.account;
  };

  const requireSeason = (seasonId: string): LeagueSeason => {
    const season = store.findLeagueSeason(seasonId);

    if (season === null) {
      throw new PlatformAppError("season_not_found", "League season was not found.");
    }

    return season;
  };

  const requireSharedRead = (
    account: AccountRecord,
    leagueId: string,
  ): PlatformLeagueMembership => {
    const memberships = store.membershipsForLeague(leagueId);
    const decision = authorizeSharedLeagueResourceRead({ id: account.id }, { leagueId }, memberships);

    if (!decision.allowed) {
      throw new PlatformAppError("membership_required", "Join this league before viewing shared league data.");
    }

    const membership = store.findMembership(account.id, leagueId);
    if (membership === null) {
      throw new PlatformAppError("membership_required", "Join this league before viewing shared league data.");
    }

    return membership;
  };

  const requireSharedMutation = (
    account: AccountRecord,
    leagueId: string,
  ): PlatformLeagueMembership => {
    const memberships = store.membershipsForLeague(leagueId);
    const decision = authorizeSharedLeagueSetupMutation({ id: account.id }, { leagueId }, memberships);

    if (!decision.allowed) {
      if (decision.reason === "league_membership_required") {
        throw new PlatformAppError("membership_required", "Join this league before changing shared league data.");
      }

      throw new PlatformAppError(
        "shared_mutation_denied",
        "Only league owners and admins can change shared draft data.",
      );
    }

    const membership = store.findMembership(account.id, leagueId);
    if (membership === null) {
      throw new PlatformAppError("membership_required", "Join this league before changing shared league data.");
    }

    return membership;
  };

  const requireSeasonRead = (account: AccountRecord, seasonId: string): LeagueSeason => {
    const season = requireSeason(seasonId);
    requireSharedRead(account, season.leagueId);

    return season;
  };

  const requirePrivateTeamContext = (
    account: AccountRecord,
    input: Omit<PrivateTeamContextInput, "actorSessionToken" | "now">,
  ): LeagueSeason => {
    const season = requireSeason(input.seasonId);
    const membership = requireSharedRead(account, input.leagueId);

    if (season.leagueId !== input.leagueId) {
      throw new PlatformAppError("league_not_found", "League does not match this season.");
    }

    const team = season.teams.find(candidate => candidate.id === input.teamId);
    if (team === undefined || team.ownerId !== input.ownerId) {
      throw new PlatformAppError("team_not_found", "Team was not found in this league season.");
    }

    if (membership.teamId === undefined || membership.ownerId === undefined) {
      throw new PlatformAppError("team_claim_required", "Claim your team before creating private prep.");
    }

    if (membership.teamId !== input.teamId || membership.ownerId !== input.ownerId) {
      throw new PlatformAppError("private_team_required", "Private prep can only use your claimed team.");
    }

    return season;
  };

  const canReadPrivateTeamContext = (
    account: AccountRecord,
    input: Omit<PrivateTeamContextInput, "actorSessionToken" | "now">,
  ): boolean => {
    try {
      requirePrivateTeamContext(account, input);

      return true;
    } catch (error) {
      if (error instanceof PlatformAppError) return false;

      throw error;
    }
  };

  const assertSeasonRegistrationAllowed = (
    account: AccountRecord,
    season: LeagueSeason,
    memberships: readonly PlatformLeagueMembership[],
  ): void => {
    const existingMembership = store.findMembership(account.id, season.leagueId);
    const leagueAlreadyRegistered = store.hasLeagueSeasonForLeague(season.leagueId);
    const submittedMembership = memberships.find(membership =>
      membership.userId === account.id && membership.leagueId === season.leagueId
    );
    const canRegisterFromExistingMembership = existingMembership !== null
      && sharedMutationRoles.has(existingMembership.role);
    const canRegisterFromSubmittedMembership = submittedMembership !== undefined
      && sharedMutationRoles.has(submittedMembership.role);

    if (
      !canRegisterFromExistingMembership
      && (leagueAlreadyRegistered || !canRegisterFromSubmittedMembership)
    ) {
      throw new PlatformAppError(
        "shared_mutation_denied",
        "Only league owners and admins can change shared draft data.",
      );
    }

    for (const membership of memberships) {
      if (membership.leagueId !== season.leagueId) {
        throw new PlatformAppError("league_not_found", "Membership does not match this league season.");
      }

      if (membership.ownerId === undefined && membership.teamId === undefined) continue;

      const team = season.teams.find(candidate =>
        candidate.id === membership.teamId && candidate.ownerId === membership.ownerId
      );

      if (team === undefined) {
        throw new PlatformAppError("team_not_found", "Membership team was not found in this league season.");
      }
    }
  };

  const liveActorFor = (
    account: AccountRecord,
    leagueId: string,
    role: WorkspaceRole,
  ): LiveDraftRoomActor => ({
    userId: account.id,
    leagueId,
    role,
  });

  const exportTeamStateFor = (room: LiveDraftRoom): DraftExportTeamState[] =>
    room.projection.teams.map(team => ({
      teamId: team.teamId,
      teamName: team.teamDisplayName,
      ownerName: team.ownerDisplayName,
      draftOrderPosition: team.draftOrderPosition,
      slots: team.slots
        .flatMap(slot => {
          if (!isExportSlotKey(slot.slot)) return [];

          return [{
            slot: slot.slot,
            ...(slot.player === undefined
              ? {}
              : {
                player: {
                  name: slot.player.name,
                  price: slot.player.price,
                  source: slot.player.source === "sale" ? "auction" : "keeper",
                },
              }),
          }];
        }),
    }));

  return {
    store,

    createAccount: (input: CreateUserInput): AccountRecord => cloneForRead(auth.createUser(input)),

    login: (input: LoginInput): LoginResult | null => {
      const login = auth.login(input);

      return login === null ? null : cloneForRead(login);
    },

    registerLeagueSeason: (input: RegisterLeagueSeasonInput): LeagueSeason => {
      const account = requireAccount(input.actorSessionToken, input.now);
      assertSeasonRegistrationAllowed(account, input.season, input.memberships);

      return store.registerLeagueSeason(input.season, input.memberships);
    },

    getLeagueSeason: (input: GetLeagueSeasonInput): LeagueSeason =>
      cloneForRead(requireSeasonRead(requireAccount(input.actorSessionToken, input.now), input.seasonId)),

    createSimulationRun: (input: CreatePlatformSimulationRunInput): SimulationRun => {
      const account = requireAccount(input.actorSessionToken, input.now);
      requirePrivateTeamContext(account, input);

      return cloneForRead(store.simulations.createRequest({
        userId: account.id,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        ownerId: input.ownerId,
        teamId: input.teamId,
        count: input.count,
        seedPrefix: input.seedPrefix,
        idempotencyKey: input.idempotencyKey,
        strategy: input.strategy,
        createdAt: input.now,
      }));
    },

    executeSimulationRun: async (input: ExecutePlatformSimulationRunInput): Promise<SimulationRun> => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const run = store.simulations.fetchForUser(input.runId, account.id);
      if (run === null) {
        throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
      }
      requirePrivateTeamContext(account, run.request);

      return cloneForRead(await executeSimulationRun({
        repository: store.simulations,
        runId: input.runId,
        runner: simulationRunner,
        now: input.now,
      }));
    },

    executeSimulationRunForWorker: async (input: ExecutePlatformSimulationRunForWorkerInput): Promise<SimulationRun> => {
      const run = store.simulations.find(input.runId);
      if (
        run.privacyOwnerUserId !== input.userId
        || run.request.leagueId !== input.leagueId
        || run.request.seasonId !== input.seasonId
      ) {
        throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
      }

      const account = store.authRepository.findAccountById(input.userId);
      if (account === null) {
        throw new PlatformAppError("private_resource", "This prep artifact belongs to a missing account.");
      }
      requirePrivateTeamContext(account, run.request);

      return cloneForRead(await executeSimulationRun({
        repository: store.simulations,
        runId: input.runId,
        runner: simulationRunner,
        now: input.now,
      }));
    },

    listSimulationRuns: (input: ListPlatformSimulationRunsInput): readonly SimulationRun[] => {
      const account = requireAccount(input.actorSessionToken, input.now);

      return store.simulations.listForUser(account.id)
        .filter(run => canReadPrivateTeamContext(account, run.request))
        .map(run => cloneForRead(run));
    },

    getSimulationRun: (input: GetPlatformSimulationRunInput): SimulationRun => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const run = store.simulations.fetchForUser(input.runId, account.id);

      if (run === null) {
        throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
      }
      requirePrivateTeamContext(account, run.request);

      return cloneForRead(run);
    },

    createMockDraftSession: (input: CreatePlatformMockDraftSessionInput): MockDraftSession => {
      const account = requireAccount(input.actorSessionToken, input.now);
      requirePrivateTeamContext(account, input);

      return cloneForRead(store.mockDraftSessions.createSession({
        userId: account.id,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        ownerId: input.ownerId,
        teamId: input.teamId,
        draftMode: input.draftMode,
        status: input.status,
        now: input.now,
      }));
    },

    listMockDraftSessions: (input: ListPlatformMockDraftSessionsInput): readonly MockDraftSession[] => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const season = requireSeason(input.seasonId);
      const membership = requireSharedRead(account, input.leagueId);

      if (season.leagueId !== input.leagueId) {
        throw new PlatformAppError("league_not_found", "League does not match this season.");
      }

      if (membership.ownerId === undefined) {
        throw new PlatformAppError("team_claim_required", "Claim your team before viewing private prep.");
      }

      if (membership.ownerId !== input.ownerId || (input.teamId !== undefined && membership.teamId !== input.teamId)) {
        throw new PlatformAppError("private_team_required", "Private prep can only use your claimed team.");
      }

      return store.mockDraftSessions.listSessionsForOwner({
        userId: account.id,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        ownerId: input.ownerId,
        teamId: input.teamId,
      }).map(session => cloneForRead(session));
    },

    appendMockDraftCommand: (input: AppendPlatformMockDraftCommandInput): MockDraftSession => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const session = store.mockDraftSessions.getSession({ userId: account.id, sessionId: input.sessionId });
      requirePrivateTeamContext(account, session);

      return cloneForRead(store.mockDraftSessions.appendCommand({
        userId: account.id,
        sessionId: input.sessionId,
        expectedRevision: input.expectedRevision,
        expectedCommandCount: input.expectedCommandCount,
        commandId: input.commandId,
        command: input.command,
        idempotencyKey: input.idempotencyKey,
        latestResultRef: input.latestResultRef,
        now: input.now,
      }));
    },

    resetMockDraftSession: (input: ResetPlatformMockDraftSessionInput): MockDraftSession => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const session = store.mockDraftSessions.getSession({ userId: account.id, sessionId: input.sessionId });
      requirePrivateTeamContext(account, session);

      return cloneForRead(store.mockDraftSessions.resetSession({
        userId: account.id,
        sessionId: input.sessionId,
        expectedRevision: input.expectedRevision,
        now: input.now,
      }));
    },

    createLiveDraftRoom: (input: CreatePlatformLiveDraftRoomInput): LiveDraftRoom => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const season = requireSeason(input.seasonId);
      requireSharedMutation(account, season.leagueId);

      return cloneForRead(store.liveDraftRooms.createRoom({
        season,
        roomId: input.roomId,
        commissionerUserId: account.id,
        viewerPasswordHashRef: input.viewerPasswordHashRef,
        startsAt: input.startsAt,
        playerCatalog: input.playerCatalog,
        initialRosters: input.initialRosters === undefined ? undefined : cloneForRead(input.initialRosters),
        createdAt: input.now,
      }));
    },

    getLiveDraftRoom: (input: GetPlatformLiveDraftRoomInput): LiveDraftRoom => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const room = store.liveDraftRooms.getRoom(input.roomId);
      const membership = requireSharedRead(account, room.leagueId);

      return cloneForRead(store.liveDraftRooms.getRoomForActor({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership.role),
      }));
    },

    startLiveDraftRoom: (input: MutatePlatformLiveDraftRoomInput): LiveDraftRoom => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const room = store.liveDraftRooms.getRoom(input.roomId);
      const membership = requireSharedMutation(account, room.leagueId);

      return cloneForRead(store.liveDraftRooms.startRoom({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership.role),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      }));
    },

    logLiveDraftSale: (input: LogPlatformLiveDraftSaleInput): LiveDraftRoom => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const room = store.liveDraftRooms.getRoom(input.roomId);
      const membership = requireSharedMutation(account, room.leagueId);

      return cloneForRead(store.liveDraftRooms.logSaleCommand({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership.role),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
        sale: input.sale,
      }));
    },

    undoLastLiveDraftSale: (input: MutatePlatformLiveDraftRoomInput): LiveDraftRoom => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const room = store.liveDraftRooms.getRoom(input.roomId);
      const membership = requireSharedMutation(account, room.leagueId);

      return cloneForRead(store.liveDraftRooms.undoLastSale({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership.role),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      }));
    },

    endLiveDraftRoom: (input: MutatePlatformLiveDraftRoomInput): LiveDraftRoom => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const room = store.liveDraftRooms.getRoom(input.roomId);
      const membership = requireSharedMutation(account, room.leagueId);

      return cloneForRead(store.liveDraftRooms.endRoom({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership.role),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      }));
    },

    exportLiveDraftRoom: (input: ExportPlatformLiveDraftRoomInput): DraftExportResult => {
      const account = requireAccount(input.actorSessionToken, input.now);
      const room = store.liveDraftRooms.getRoom(input.roomId);
      requireSharedRead(account, room.leagueId);

      return generateDraftExport({
        leagueName: room.season.league.name,
        seasonYear: room.season.seasonYear,
        draftRoomId: room.roomId,
        exportedAt: input.exportedAt,
        status: room.status,
        revision: room.revision,
        teams: exportTeamStateFor(room),
      });
    },
  };
};
