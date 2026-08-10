import {
  InMemoryAuthRepository,
  createAuthService,
  type AccountCredentialRecord,
  type AccountRecord,
  type AuthRepository,
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
import {
  InMemoryExportArtifactRepository,
  createDraftExportArtifact,
  type DraftExportArtifactResult,
  type ExportArtifact,
  type ExportArtifactContent,
  type ExportArtifactRepository,
} from "./exportArtifacts.js";
import {
  InMemoryHistoricalImportRepository,
  type HistoricalImportBatch,
  type HistoricalImportRepository,
  type HistoricalSaleRecord,
} from "./historicalImports.js";
import {
  InMemoryJobQueue,
  jobRerunIdempotencyKeyFor,
  type JobRecord,
  type JobRepository,
} from "./jobs.js";
import type { LeagueSeason } from "./leagueSeason.js";
import {
  membershipKeyFor,
  type LeagueSetupRepository,
  type PlatformLeagueMembership,
  type RegisterLeagueSeasonRepositoryInput,
} from "./leagueSetup.js";
import {
  InMemoryLiveDraftRoomRepository,
  type CreateLiveDraftRoomInput,
  type LiveDraftRoom,
  type LiveDraftRoomInitialRosterPlayer,
  type LiveDraftRoomPlayerCatalogEntry,
  type LiveDraftRoomRepository,
  type LiveDraftRoomSaleCommandInput,
} from "./liveDraftRooms.js";
import {
  buildLiveDraftRoomReadModel,
  liveDraftRoomEventsAfterRevision,
  type LiveDraftRoomEventsAfterRevisionResult,
  type LiveDraftRoomReadModel,
  type LiveDraftRoomStreamActor,
} from "./liveDraftRoomStream.js";
import {
  InMemoryMockDraftSessionRepository,
  type AppendMockDraftCommandInput,
  type MockDraftSession,
  type MockDraftModeMetadata,
  type MockDraftResultReference,
} from "./mockSessions.js";
import {
  InMemorySimulationRepository,
  executeSimulationRun,
  type CreateSimulationRequestInput,
  type SimulationRepository,
  type SimulationMockBatchRunner,
  type SimulationRun,
} from "./simulations.js";
import {
  commitHistoricalImportWorkflow,
  previewHistoricalImportSourceWorkflow,
  type CommitHistoricalImportWorkflowResult,
  type PreviewHistoricalImportSourceWorkflowResult,
} from "./platformHistoricalImportWorkflow.js";
import {
  enqueueSimulationRunExecutionJob,
  platformJobTypes,
} from "./platformJobOrchestrator.js";
import {
  listLeaguePricingSnapshotsWorkflow,
  readLatestPricingSnapshotWorkflow,
  rebuildLeaguePricingWorkflow,
  type RebuildLeaguePricingWorkflowResult,
} from "./platformPricingWorkflow.js";
import {
  createInMemoryPricingSnapshotRepository,
  type PricingSnapshot,
  type PricingSnapshotRepository,
  type PricingSourcePrice,
} from "./pricingSnapshots.js";
import {
  authorizeSharedLeagueResourceRead,
  authorizeSharedLeagueSetupMutation,
  type WorkspaceRole,
} from "./workspacePrivacy.js";

export type { PlatformLeagueMembership } from "./leagueSetup.js";

export type PlatformAppErrorCode =
  | "auth_required"
  | "draft_room_not_final"
  | "historical_import_not_found"
  | "league_not_found"
  | "membership_required"
  | "private_resource"
  | "private_team_required"
  | "pricing_snapshot_not_found"
  | "season_not_found"
  | "shared_mutation_denied"
  | "team_already_claimed"
  | "team_claim_locked"
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

export interface RegisterLeagueSeasonInput {
  actorSessionToken: string;
  season: LeagueSeason;
  memberships: readonly PlatformLeagueMembership[];
  now?: Date | undefined;
}

export interface ClaimLeagueSeasonTeamInput {
  actorSessionToken: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  now?: Date | undefined;
}

export interface GetLeagueSeasonInput {
  actorSessionToken: string;
  seasonId: string;
  now?: Date | undefined;
}

export interface LogoutInput {
  actorSessionToken: string;
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

export interface EnqueuePlatformSimulationRunJobInput {
  actorSessionToken: string;
  runId: string;
  idempotencyKey?: string | undefined;
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

export interface ListPlatformJobsInput {
  actorSessionToken: string;
  now?: Date | undefined;
}

export interface GetPlatformJobInput {
  actorSessionToken: string;
  jobId: string;
  now?: Date | undefined;
}

export interface CancelPlatformJobInput {
  actorSessionToken: string;
  jobId: string;
  now?: Date | undefined;
}

export interface RerunPlatformJobInput {
  actorSessionToken: string;
  jobId: string;
  idempotencyKey: string;
  now?: Date | undefined;
}

export interface PreviewPlatformHistoricalImportInput {
  actorSessionToken: string;
  leagueId: string;
  seasonYear: number;
  sourceText: string;
  replacementRequested?: boolean | undefined;
  now?: Date | undefined;
}

export interface CommitPlatformHistoricalImportInput {
  actorSessionToken: string;
  batchId: string;
  now?: Date | undefined;
}

export interface RebuildPlatformPricingInput {
  actorSessionToken: string;
  leagueId: string;
  seasonYear: number;
  modelVersion: string;
  scenarioIds: readonly string[];
  baselinePrices: readonly PricingSourcePrice[];
  now?: Date | undefined;
}

export interface ListPlatformPricingSnapshotsInput {
  actorSessionToken: string;
  leagueId: string;
  seasonYear: number | string;
  modelRunId?: string | undefined;
  scenarioId?: string | undefined;
  now?: Date | undefined;
}

export interface GetPlatformPricingSnapshotInput {
  actorSessionToken: string;
  modelRunId: string;
  scenarioId?: string | undefined;
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
  selectedTeamId?: string | undefined;
  viewedTeamId?: string | undefined;
  now?: Date | undefined;
}

export interface GetPlatformLiveDraftRoomEventsInput extends GetPlatformLiveDraftRoomInput {
  afterRevision: number;
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

export interface CorrectPlatformLiveDraftSaleInput extends MutatePlatformLiveDraftRoomInput {
  saleEventId: string;
  replacementSale: LiveDraftRoomSaleCommandInput;
}

export interface ExportPlatformLiveDraftRoomInput {
  actorSessionToken: string;
  roomId: string;
  exportedAt: Date;
  now?: Date | undefined;
}

export interface CreatePlatformLiveDraftExportArtifactInput extends ExportPlatformLiveDraftRoomInput {}

export interface PlatformAppOptions {
  store?: InMemoryPlatformStore | undefined;
  authRepository?: AuthRepository | undefined;
  leagueSetupRepository?: LeagueSetupRepository | undefined;
  historicalImportRepository?: HistoricalImportRepository | undefined;
  jobRepository?: JobRepository | undefined;
  simulationRepository?: SimulationRepository | undefined;
  liveDraftRoomRepository?: LiveDraftRoomRepository | undefined;
  exportArtifactRepository?: ExportArtifactRepository | undefined;
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
  historicalImportBatches: readonly HistoricalImportBatch[];
  historicalSaleRecords: readonly HistoricalSaleRecord[];
  pricingSnapshots: readonly PricingSnapshot[];
  jobs: readonly JobRecord[];
  exportArtifacts: readonly ExportArtifact[];
  exportArtifactContents: readonly ExportArtifactContent[];
}

const draftExportSlotKeys = new Set<string>(draftExportSlotOrder);
const sharedMutationRoles = new Set<WorkspaceRole>(["owner", "admin"]);

const cloneForRead = <T>(value: T): T => structuredClone(value);

interface JobInputRecord {
  readonly type?: unknown;
  readonly simulationRunId?: unknown;
}

const isJobInputRecord = (value: unknown): value is JobInputRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const simulationRunIdForJob = (job: JobRecord): string | null => {
  if (!isJobInputRecord(job.inputJson)) return null;

  return job.inputJson.type === platformJobTypes.simulationRunExecution &&
    typeof job.inputJson.simulationRunId === "string"
    ? job.inputJson.simulationRunId
    : null;
};

const isExportSlotKey = (slot: string): slot is DraftExportRosterSlotKey => draftExportSlotKeys.has(slot);

export class InMemoryPlatformStore implements LeagueSetupRepository {
  readonly authRepository = new InMemoryAuthRepository();
  readonly exportArtifacts = new InMemoryExportArtifactRepository();
  readonly historicalImports = new InMemoryHistoricalImportRepository();
  readonly jobs = new InMemoryJobQueue();
  readonly mockDraftSessions = new InMemoryMockDraftSessionRepository();
  readonly pricingSnapshots: PricingSnapshotRepository = createInMemoryPricingSnapshotRepository();
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

  registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput): LeagueSeason {
    const storedSeason = cloneForRead(input.season);

    this.#leagueSeasonsById.set(storedSeason.id, storedSeason);

    for (const [membershipKey, membership] of this.#membershipsByUserAndLeague) {
      if (membership.leagueId === storedSeason.leagueId) {
        this.#membershipsByUserAndLeague.delete(membershipKey);
      }
    }

    for (const membership of input.memberships) {
      this.#membershipsByUserAndLeague.set(membershipKeyFor(membership.userId, membership.leagueId), {
        ...cloneForRead(membership),
      });
    }
    this.#syncHistoricalImportSeasons();

    return cloneForRead(storedSeason);
  }

  claimLeagueSeasonTeam(input: {
    seasonId: string;
    leagueId: string;
    userId: string;
    ownerId: string;
    teamId: string;
    now?: Date | undefined;
  }): PlatformLeagueMembership | null {
    const season = this.#leagueSeasonsById.get(input.seasonId);
    if (season === undefined || season.leagueId !== input.leagueId) return null;

    const team = season.teams.find(candidate =>
      candidate.id === input.teamId && candidate.ownerId === input.ownerId
    );
    if (team === undefined) return null;

    const membershipKey = membershipKeyFor(input.userId, input.leagueId);
    const membership = this.#membershipsByUserAndLeague.get(membershipKey);
    if (membership === undefined) return null;

    const claimedByOther = [...this.#membershipsByUserAndLeague.values()].some(candidate =>
      candidate.leagueId === input.leagueId &&
      candidate.userId !== input.userId &&
      candidate.teamId === input.teamId
    );
    if (claimedByOther) return null;

    const claimedMembership = {
      ...membership,
      ownerId: input.ownerId,
      teamId: input.teamId,
    };
    this.#membershipsByUserAndLeague.set(membershipKey, claimedMembership);

    return cloneForRead(claimedMembership);
  }

  findLeagueSeason(seasonId: string): LeagueSeason | null {
    const season = this.#leagueSeasonsById.get(seasonId);

    return season === undefined ? null : cloneForRead(season);
  }

  hasLeagueSeasonForLeague(leagueId: string): boolean {
    return [...this.#leagueSeasonsById.values()]
      .some(season => season.leagueId === leagueId);
  }

  findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number): LeagueSeason | null {
    const season = [...this.#leagueSeasonsById.values()]
      .find(candidate => candidate.leagueId === leagueId && candidate.seasonYear === seasonYear);

    return season === undefined ? null : cloneForRead(season);
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

  replaceMembershipsForLeague(
    leagueId: string,
    memberships: readonly PlatformLeagueMembership[],
  ): void {
    for (const [membershipKey, membership] of this.#membershipsByUserAndLeague) {
      if (membership.leagueId === leagueId) {
        this.#membershipsByUserAndLeague.delete(membershipKey);
      }
    }

    for (const membership of memberships) {
      this.#membershipsByUserAndLeague.set(
        membershipKeyFor(membership.userId, membership.leagueId),
        cloneForRead(membership),
      );
    }
  }

  clearAuthSnapshotState(): void {
    this.authRepository.clear();
  }

  clearHistoricalImportSnapshotState(): void {
    this.historicalImports.replaceBatchesAndRecords([], []);
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
      historicalImportBatches: this.historicalImports.batches(),
      historicalSaleRecords: this.historicalImports.records(),
      pricingSnapshots: this.pricingSnapshots.list(),
      jobs: this.jobs.jobs(),
      exportArtifacts: this.exportArtifacts.artifacts(),
      exportArtifactContents: this.exportArtifacts.contents(),
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

    this.#syncHistoricalImportSeasons();
    this.historicalImports.replaceBatchesAndRecords(
      snapshot.historicalImportBatches ?? [],
      snapshot.historicalSaleRecords ?? [],
    );
    for (const pricingSnapshot of snapshot.pricingSnapshots ?? []) {
      this.pricingSnapshots.save(pricingSnapshot);
    }
    this.jobs.replaceJobs(snapshot.jobs ?? []);
    this.exportArtifacts.replaceArtifactsAndContents(
      snapshot.exportArtifacts ?? [],
      snapshot.exportArtifactContents ?? [],
    );
    this.liveDraftRooms.replaceRooms(snapshot.liveDraftRooms);
    this.mockDraftSessions.replaceSessions(snapshot.mockDraftSessions ?? []);
    this.simulations.replaceRuns(snapshot.simulationRuns ?? []);
  }

  #syncHistoricalImportSeasons(): void {
    this.historicalImports.replaceLeagueSeasons([...this.#leagueSeasonsById.values()]);
  }
}

export const createPlatformApp = ({
  store = new InMemoryPlatformStore(),
  authRepository,
  leagueSetupRepository,
  historicalImportRepository,
  jobRepository,
  simulationRepository,
  liveDraftRoomRepository,
  exportArtifactRepository,
  simulationRunner,
}: PlatformAppOptions) => {
  const runtimeAuthRepository = authRepository ?? store.authRepository;
  const leagueSetup = leagueSetupRepository ?? store;
  const historicalImports = historicalImportRepository ?? store.historicalImports;
  const auth = createAuthService({ repository: runtimeAuthRepository });
  const jobs = jobRepository ?? store.jobs;
  const simulations = simulationRepository ?? store.simulations;
  const liveDraftRooms = liveDraftRoomRepository ?? store.liveDraftRooms;
  const exportArtifacts = exportArtifactRepository ?? store.exportArtifacts;
  const usesExternalLeagueSetup = leagueSetup !== store;

  const requireAccount = async (sessionToken: string, now?: Date): Promise<AccountRecord> => {
    const authenticated = await auth.lookupSession(sessionToken, now);

    if (authenticated === null) {
      throw new PlatformAppError("auth_required", "Sign in before using this workspace.");
    }

    return authenticated.account;
  };

  const mirrorLeagueSetup = async (season: LeagueSeason): Promise<LeagueSeason> => {
    if (usesExternalLeagueSetup) {
      store.registerLeagueSeason({
        season,
        memberships: await leagueSetup.membershipsForLeague(season.leagueId),
        createdByUserId: "external",
      });
    }

    return season;
  };

  const mirrorLeagueMemberships = (leagueId: string, memberships: readonly PlatformLeagueMembership[]): void => {
    if (usesExternalLeagueSetup) {
      store.replaceMembershipsForLeague(leagueId, memberships);
    }
  };

  const requireSeason = async (seasonId: string): Promise<LeagueSeason> => {
    const season = await leagueSetup.findLeagueSeason(seasonId);

    if (season === null) {
      throw new PlatformAppError("season_not_found", "League season was not found.");
    }

    return await mirrorLeagueSetup(season);
  };

  const requireSeasonForLeagueYear = async (leagueId: string, seasonYear: number): Promise<LeagueSeason> => {
    const season = await leagueSetup.findLeagueSeasonForLeagueYear(leagueId, seasonYear);

    if (season === null) {
      throw new PlatformAppError("season_not_found", "League season was not found.");
    }

    return await mirrorLeagueSetup(season);
  };

  const requireSharedRead = async (
    account: AccountRecord,
    leagueId: string,
  ): Promise<PlatformLeagueMembership> => {
    const memberships = await leagueSetup.membershipsForLeague(leagueId);
    const decision = authorizeSharedLeagueResourceRead({ id: account.id }, { leagueId }, memberships);

    if (!decision.allowed) {
      throw new PlatformAppError("membership_required", "Join this league before viewing shared league data.");
    }

    const membership = await leagueSetup.findMembership(account.id, leagueId);
    if (membership === null) {
      throw new PlatformAppError("membership_required", "Join this league before viewing shared league data.");
    }
    mirrorLeagueMemberships(leagueId, memberships);

    return membership;
  };

  const requireSharedMutation = async (
    account: AccountRecord,
    leagueId: string,
  ): Promise<PlatformLeagueMembership> => {
    const memberships = await leagueSetup.membershipsForLeague(leagueId);
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

    const membership = await leagueSetup.findMembership(account.id, leagueId);
    if (membership === null) {
      throw new PlatformAppError("membership_required", "Join this league before changing shared league data.");
    }
    mirrorLeagueMemberships(leagueId, memberships);

    return membership;
  };

  const requireSeasonRead = async (account: AccountRecord, seasonId: string): Promise<LeagueSeason> => {
    const season = await requireSeason(seasonId);
    await requireSharedRead(account, season.leagueId);

    return season;
  };

  const requirePrivateTeamContext = async (
    account: AccountRecord,
    input: Omit<PrivateTeamContextInput, "actorSessionToken" | "now">,
  ): Promise<LeagueSeason> => {
    const season = await requireSeason(input.seasonId);
    const membership = await requireSharedRead(account, input.leagueId);

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

  const canReadPrivateTeamContext = async (
    account: AccountRecord,
    input: Omit<PrivateTeamContextInput, "actorSessionToken" | "now">,
  ): Promise<boolean> => {
    try {
      await requirePrivateTeamContext(account, input);

      return true;
    } catch (error) {
      if (error instanceof PlatformAppError) return false;

      throw error;
    }
  };

  const requireReadableMockDraftResultReference = async (
    account: AccountRecord,
    latestResultRef: MockDraftResultReference | undefined,
  ): Promise<MockDraftResultReference | undefined> => {
    if (latestResultRef === undefined || latestResultRef.kind !== "simulation-result") return latestResultRef;

    const run = await simulations.fetchForUser(latestResultRef.id, account.id);
    if (run === null) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
    }
    await requirePrivateTeamContext(account, run.request);

    return latestResultRef;
  };

  const assertSeasonRegistrationAllowed = async (
    account: AccountRecord,
    season: LeagueSeason,
    memberships: readonly PlatformLeagueMembership[],
  ): Promise<void> => {
    const existingMembership = await leagueSetup.findMembership(account.id, season.leagueId);
    const leagueAlreadyRegistered = await leagueSetup.hasLeagueSeasonForLeague(season.leagueId);
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
    membership: Pick<PlatformLeagueMembership, "ownerId" | "role" | "teamId">,
  ): LiveDraftRoomStreamActor => ({
    userId: account.id,
    leagueId,
    role: membership.role,
    ...(membership.ownerId === undefined ? {} : { ownerId: membership.ownerId }),
    ...(membership.teamId === undefined ? {} : { teamId: membership.teamId }),
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
    authRepository: runtimeAuthRepository,
    leagueSetupRepository: leagueSetup,

    createAccount: async (input: CreateUserInput): Promise<AccountRecord> =>
      cloneForRead(await auth.createUser(input)),

    login: async (input: LoginInput): Promise<LoginResult | null> => {
      const login = await auth.login(input);

      return login === null ? null : cloneForRead(login);
    },

    findAccountByEmail: async (email: string): Promise<AccountRecord | null> => {
      const credential = await runtimeAuthRepository.findAccountCredentialByEmail(email.trim().toLowerCase());

      return credential === null ? null : cloneForRead(credential.account);
    },

    findAccountBySessionToken: async (sessionToken: string, now?: Date): Promise<AccountRecord | null> => {
      const authenticated = await auth.lookupSession(sessionToken, now);

      return authenticated === null ? null : cloneForRead(authenticated.account);
    },

    logout: async (input: LogoutInput): Promise<boolean> =>
      await auth.logout(input.actorSessionToken, input.now),

    listLeagueMemberships: async (leagueId: string): Promise<readonly PlatformLeagueMembership[]> =>
      cloneForRead(await leagueSetup.membershipsForLeague(leagueId)),

    registerLeagueSeason: async (input: RegisterLeagueSeasonInput): Promise<LeagueSeason> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      await assertSeasonRegistrationAllowed(account, input.season, input.memberships);
      const registeredSeason = await leagueSetup.registerLeagueSeason({
        season: input.season,
        memberships: input.memberships,
        createdByUserId: account.id,
        now: input.now,
      });
      if (usesExternalLeagueSetup) {
        store.registerLeagueSeason({
          season: registeredSeason,
          memberships: input.memberships,
          createdByUserId: account.id,
          now: input.now,
        });
      }

      return cloneForRead(registeredSeason);
    },

    claimLeagueSeasonTeam: async (input: ClaimLeagueSeasonTeamInput): Promise<PlatformLeagueMembership> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const season = await requireSeason(input.seasonId);
      const currentMembership = await requireSharedRead(account, season.leagueId);
      const team = season.teams.find(candidate =>
        candidate.id === input.teamId && candidate.ownerId === input.ownerId
      );
      if (team === undefined) {
        throw new PlatformAppError("team_not_found", "Team was not found in this league season.");
      }

      const changesExistingClaim = currentMembership.teamId !== undefined && (
        currentMembership.teamId !== team.id || currentMembership.ownerId !== team.ownerId
      );
      if (changesExistingClaim && await liveDraftRooms.hasStartedRoomForSeason(season.id)) {
        throw new PlatformAppError(
          "team_claim_locked",
          "Your team claim is locked because this league's live draft has started.",
        );
      }

      const memberships = await leagueSetup.membershipsForLeague(season.leagueId);
      const claimedByOther = memberships.some(membership =>
        membership.userId !== account.id && membership.teamId === input.teamId
      );
      if (claimedByOther) {
        throw new PlatformAppError("team_already_claimed", "That team is already claimed.");
      }

      const membership = await leagueSetup.claimLeagueSeasonTeam({
        seasonId: season.id,
        leagueId: season.leagueId,
        userId: account.id,
        ownerId: team.ownerId,
        teamId: team.id,
        now: input.now,
      });

      if (membership === null) {
        throw new PlatformAppError("team_already_claimed", "That team is already claimed.");
      }
      if (usesExternalLeagueSetup) {
        store.claimLeagueSeasonTeam({
          seasonId: season.id,
          leagueId: season.leagueId,
          userId: account.id,
          ownerId: team.ownerId,
          teamId: team.id,
          now: input.now,
        });
      }

      return cloneForRead(membership);
    },

    getLeagueSeason: async (input: GetLeagueSeasonInput): Promise<LeagueSeason> =>
      cloneForRead(await requireSeasonRead(await requireAccount(input.actorSessionToken, input.now), input.seasonId)),

    createSimulationRun: async (input: CreatePlatformSimulationRunInput): Promise<SimulationRun> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      await requirePrivateTeamContext(account, input);

      return cloneForRead(await simulations.createRequest({
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
      const account = await requireAccount(input.actorSessionToken, input.now);
      const run = await simulations.fetchForUser(input.runId, account.id);
      if (run === null) {
        throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
      }
      await requirePrivateTeamContext(account, run.request);

      return cloneForRead(await executeSimulationRun({
        repository: simulations,
        runId: input.runId,
        runner: simulationRunner,
        now: input.now,
      }));
    },

    executeSimulationRunForWorker: async (input: ExecutePlatformSimulationRunForWorkerInput): Promise<SimulationRun> => {
      const run = await simulations.find(input.runId);
      if (
        run.privacyOwnerUserId !== input.userId
        || run.request.leagueId !== input.leagueId
        || run.request.seasonId !== input.seasonId
      ) {
        throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
      }

      const account = await runtimeAuthRepository.findAccountById(input.userId);
      if (account === null) {
        throw new PlatformAppError("private_resource", "This prep artifact belongs to a missing account.");
      }
      await requirePrivateTeamContext(account, run.request);

      return cloneForRead(await executeSimulationRun({
        repository: simulations,
        runId: input.runId,
        runner: simulationRunner,
        now: input.now,
      }));
    },

    listSimulationRuns: async (input: ListPlatformSimulationRunsInput): Promise<readonly SimulationRun[]> => {
      const account = await requireAccount(input.actorSessionToken, input.now);

      const readableRuns: SimulationRun[] = [];
      for (const run of await simulations.listForUser(account.id)) {
        if (await canReadPrivateTeamContext(account, run.request)) {
          readableRuns.push(run);
        }
      }

      return readableRuns.map(run => cloneForRead(run));
    },

    getSimulationRun: async (input: GetPlatformSimulationRunInput): Promise<SimulationRun> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const run = await simulations.fetchForUser(input.runId, account.id);

      if (run === null) {
        throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
      }
      await requirePrivateTeamContext(account, run.request);

      return cloneForRead(run);
    },

    enqueueSimulationRunExecutionJob: async (input: EnqueuePlatformSimulationRunJobInput): Promise<JobRecord> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const run = await simulations.fetchForUser(input.runId, account.id);
      if (run === null) {
        throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
      }
      await requirePrivateTeamContext(account, run.request);

      const job = await enqueueSimulationRunExecutionJob({
        repository: jobs,
        userId: account.id,
        leagueId: run.request.leagueId,
        seasonId: run.request.seasonId,
        simulationRunId: run.id,
        runCount: run.request.count,
        seedPrefix: run.request.seedPrefix,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      });

      return cloneForRead(job);
    },

    listJobs: async (input: ListPlatformJobsInput): Promise<readonly JobRecord[]> => {
      const account = await requireAccount(input.actorSessionToken, input.now);

      return (await jobs.listForUser(account.id)).map(job => cloneForRead(job));
    },

    getJob: async (input: GetPlatformJobInput): Promise<JobRecord> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const job = await jobs.fetchForUser(input.jobId, account.id);

      if (job === null) {
        throw new PlatformAppError("private_resource", "This job belongs to another user.");
      }

      return cloneForRead(job);
    },

    cancelJob: async (input: CancelPlatformJobInput): Promise<JobRecord> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const job = await jobs.fetchForUser(input.jobId, account.id);

      if (job === null) {
        throw new PlatformAppError("private_resource", "This job belongs to another user.");
      }

      const canceledJob = await jobs.cancelJob({
        jobId: input.jobId,
        userId: account.id,
        now: input.now,
      });
      if (canceledJob.status === "canceled" || canceledJob.cancellationRequestedAt !== undefined) {
        const simulationRunId = simulationRunIdForJob(canceledJob);
        if (simulationRunId !== null) {
          await simulations.markCanceled(simulationRunId);
        }
      }

      return cloneForRead(canceledJob);
    },

    rerunJob: async (input: RerunPlatformJobInput): Promise<JobRecord> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const job = await jobs.fetchForUser(input.jobId, account.id);

      if (job === null) {
        throw new PlatformAppError("private_resource", "This job belongs to another user.");
      }

      const rerunIdempotencyKey = jobRerunIdempotencyKeyFor(job.id, input.idempotencyKey.trim());
      const existingRerunJob = (await jobs.listForUser(account.id)).find(candidateJob =>
        candidateJob.leagueId === job.leagueId &&
        candidateJob.seasonId === job.seasonId &&
        candidateJob.idempotencyKey === rerunIdempotencyKey
      );
      const rerunJob = await jobs.rerunJob({
        jobId: input.jobId,
        userId: account.id,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      });
      const simulationRunId = simulationRunIdForJob(rerunJob);
      if (existingRerunJob === undefined && rerunJob.status === "queued" && simulationRunId !== null) {
        await simulations.resetForRerun(simulationRunId);
      }

      return cloneForRead(rerunJob);
    },

    previewHistoricalImportSource: async (
      input: PreviewPlatformHistoricalImportInput,
    ): Promise<PreviewHistoricalImportSourceWorkflowResult> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      await requireSeasonForLeagueYear(input.leagueId, input.seasonYear);
      await requireSharedMutation(account, input.leagueId);

      return cloneForRead(await previewHistoricalImportSourceWorkflow({
        repository: historicalImports,
        leagueId: input.leagueId,
        seasonYear: input.seasonYear,
        sourceText: input.sourceText,
        uploadedByUserId: account.id,
        ...(input.replacementRequested === undefined ? {} : { replacementRequested: input.replacementRequested }),
        ...(input.now === undefined ? {} : { now: input.now }),
      }));
    },

    commitHistoricalImport: async (
      input: CommitPlatformHistoricalImportInput,
    ): Promise<CommitHistoricalImportWorkflowResult> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const batch = await historicalImports.findBatchById(input.batchId);
      if (batch === null) {
        throw new PlatformAppError("historical_import_not_found", "Historical import batch was not found.");
      }
      await requireSharedMutation(account, batch.leagueId);

      return cloneForRead(await commitHistoricalImportWorkflow({
        repository: historicalImports,
        batchId: input.batchId,
        ...(input.now === undefined ? {} : { now: input.now }),
      }));
    },

    rebuildLeaguePricing: async (
      input: RebuildPlatformPricingInput,
    ): Promise<RebuildLeaguePricingWorkflowResult> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const season = await requireSeasonForLeagueYear(input.leagueId, input.seasonYear);
      await requireSharedMutation(account, input.leagueId);

      const historicalSaleRecords = await historicalImports.currentRecordsThroughSeason(input.leagueId, input.seasonYear);

      return cloneForRead(rebuildLeaguePricingWorkflow({
        repository: store.pricingSnapshots,
        leagueId: input.leagueId,
        seasonYear: input.seasonYear,
        modelVersion: input.modelVersion,
        scenarioIds: input.scenarioIds,
        baselinePrices: input.baselinePrices,
        historicalSaleRecords,
        currentAuctionBudget: season.settings.auction.budgetDollars,
        currentTeamCount: season.teams.length,
        keeperLockedSpend: 0,
        ...(input.now === undefined ? {} : { createdAt: input.now.toISOString() }),
      }));
    },

    listLeaguePricingSnapshots: async (
      input: ListPlatformPricingSnapshotsInput,
    ): Promise<readonly PricingSnapshot[]> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      await requireSeasonForLeagueYear(input.leagueId, Number(input.seasonYear));
      await requireSharedRead(account, input.leagueId);

      return listLeaguePricingSnapshotsWorkflow(store.pricingSnapshots, {
        leagueId: input.leagueId,
        seasonYear: input.seasonYear,
        ...(input.modelRunId === undefined ? {} : { modelRunId: input.modelRunId }),
        ...(input.scenarioId === undefined ? {} : { scenarioId: input.scenarioId }),
      }).map(snapshot => cloneForRead(snapshot));
    },

    getPricingSnapshot: async (input: GetPlatformPricingSnapshotInput): Promise<PricingSnapshot> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const snapshot = readLatestPricingSnapshotWorkflow(store.pricingSnapshots, {
        modelRunId: input.modelRunId,
        ...(input.scenarioId === undefined ? {} : { scenarioId: input.scenarioId }),
      });

      if (snapshot === undefined) {
        throw new PlatformAppError("pricing_snapshot_not_found", "Pricing snapshot was not found.");
      }
      await requireSharedRead(account, snapshot.leagueId);

      return cloneForRead(snapshot);
    },

    createMockDraftSession: async (input: CreatePlatformMockDraftSessionInput): Promise<MockDraftSession> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      await requirePrivateTeamContext(account, input);

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

    listMockDraftSessions: async (
      input: ListPlatformMockDraftSessionsInput,
    ): Promise<readonly MockDraftSession[]> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const season = await requireSeason(input.seasonId);
      const membership = await requireSharedRead(account, input.leagueId);

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

    appendMockDraftCommand: async (input: AppendPlatformMockDraftCommandInput): Promise<MockDraftSession> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const session = store.mockDraftSessions.getSession({ userId: account.id, sessionId: input.sessionId });
      await requirePrivateTeamContext(account, session);
      const latestResultRef = await requireReadableMockDraftResultReference(account, input.latestResultRef);

      return cloneForRead(store.mockDraftSessions.appendCommand({
        userId: account.id,
        sessionId: input.sessionId,
        expectedRevision: input.expectedRevision,
        expectedCommandCount: input.expectedCommandCount,
        commandId: input.commandId,
        command: input.command,
        idempotencyKey: input.idempotencyKey,
        latestResultRef,
        now: input.now,
      }));
    },

    resetMockDraftSession: async (input: ResetPlatformMockDraftSessionInput): Promise<MockDraftSession> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const session = store.mockDraftSessions.getSession({ userId: account.id, sessionId: input.sessionId });
      await requirePrivateTeamContext(account, session);

      return cloneForRead(store.mockDraftSessions.resetSession({
        userId: account.id,
        sessionId: input.sessionId,
        expectedRevision: input.expectedRevision,
        now: input.now,
      }));
    },

    createLiveDraftRoom: async (input: CreatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const season = await requireSeason(input.seasonId);
      await requireSharedMutation(account, season.leagueId);

      return cloneForRead(await liveDraftRooms.createRoom({
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

    getLiveDraftRoom: async (input: GetPlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedRead(account, room.leagueId);

      return cloneForRead(await liveDraftRooms.getRoomForActor({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
      }));
    },

    getLiveDraftRoomState: async (
      input: GetPlatformLiveDraftRoomInput,
    ): Promise<LiveDraftRoomReadModel> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedRead(account, room.leagueId);
      const actor = liveActorFor(account, room.leagueId, membership);
      const authorizedRoom = await liveDraftRooms.getRoomForActor({
        roomId: input.roomId,
        actor,
      });

      return cloneForRead(buildLiveDraftRoomReadModel({
        room: authorizedRoom,
        actor,
        selectedTeamId: input.selectedTeamId,
        viewedTeamId: input.viewedTeamId,
      }));
    },

    getLiveDraftRoomEvents: async (
      input: GetPlatformLiveDraftRoomEventsInput,
    ): Promise<LiveDraftRoomEventsAfterRevisionResult> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedRead(account, room.leagueId);
      await liveDraftRooms.getRoomForActor({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
      });

      return cloneForRead(liveDraftRoomEventsAfterRevision({
        room,
        actor: liveActorFor(account, room.leagueId, membership),
        afterRevision: input.afterRevision,
      }));
    },

    startLiveDraftRoom: async (input: MutatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedMutation(account, room.leagueId);

      return cloneForRead(await liveDraftRooms.startRoom({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      }));
    },

    pauseLiveDraftRoom: async (input: MutatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedMutation(account, room.leagueId);

      return cloneForRead(await liveDraftRooms.pauseRoom({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      }));
    },

    resumeLiveDraftRoom: async (input: MutatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedMutation(account, room.leagueId);

      return cloneForRead(await liveDraftRooms.resumeRoom({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      }));
    },

    logLiveDraftSale: async (input: LogPlatformLiveDraftSaleInput): Promise<LiveDraftRoom> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedMutation(account, room.leagueId);

      return cloneForRead(await liveDraftRooms.logSaleCommand({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
        sale: input.sale,
      }));
    },

    correctLiveDraftSale: async (input: CorrectPlatformLiveDraftSaleInput): Promise<LiveDraftRoom> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedMutation(account, room.leagueId);

      return cloneForRead(await liveDraftRooms.correctSale({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
        saleEventId: input.saleEventId,
        replacementSale: input.replacementSale,
      }));
    },

    undoLastLiveDraftSale: async (input: MutatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedMutation(account, room.leagueId);

      return cloneForRead(await liveDraftRooms.undoLastSale({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      }));
    },

    endLiveDraftRoom: async (input: MutatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedMutation(account, room.leagueId);

      return cloneForRead(await liveDraftRooms.endRoom({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      }));
    },

    exportLiveDraftRoom: async (input: ExportPlatformLiveDraftRoomInput): Promise<DraftExportResult> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      await requireSharedRead(account, room.leagueId);

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

    createLiveDraftRoomExportArtifact: async (
      input: CreatePlatformLiveDraftExportArtifactInput,
    ): Promise<DraftExportArtifactResult> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      await requireSharedRead(account, room.leagueId);
      if (room.status !== "ended") {
        throw new PlatformAppError(
          "draft_room_not_final",
          "Draft room must be ended before creating a final export artifact.",
        );
      }
      const existingArtifactResult = await exportArtifacts.findByRoomRevision(room.roomId, room.revision);
      if (existingArtifactResult !== undefined) {
        return {
          artifact: cloneForRead(existingArtifactResult.artifact),
          content: Buffer.from(existingArtifactResult.content),
        };
      }

      const draftExport = generateDraftExport({
        leagueName: room.season.league.name,
        seasonYear: room.season.seasonYear,
        draftRoomId: room.roomId,
        exportedAt: input.exportedAt,
        status: room.status,
        revision: room.revision,
        teams: exportTeamStateFor(room),
      });
      const artifactResult = createDraftExportArtifact({
        draftExport,
        leagueId: room.leagueId,
        seasonId: room.seasonId,
        roomId: room.roomId,
        sourceRevision: room.revision,
        createdAt: input.exportedAt,
      });
      const savedArtifactResult = await exportArtifacts.save(artifactResult, { createdByUserId: account.id });

      return {
        artifact: cloneForRead(savedArtifactResult.artifact),
        content: Buffer.from(savedArtifactResult.content),
      };
    },
  };
};
