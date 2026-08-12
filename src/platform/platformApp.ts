import {
  InMemoryAuthRepository,
  createAuthService,
  type AccountCredentialRecord,
  type AccountRecord,
  type AuthRepository,
  type AuthMailSender,
  type AcceptedAuthRequest,
  type CreateUserInput,
  type LoginInput,
  type LoginResult,
  type RequestEmailVerificationInput,
  type RequestPasswordResetInput,
  type ResetPasswordWithTokenInput,
  type VerifyEmailInput,
  type PasswordReplacementResult,
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
  prepareHistoricalImportBatchCommit,
  type HistoricalImportBatch,
  type HistoricalImportPlayerCatalogEntry,
  type HistoricalImportRepository,
  type HistoricalOwnerMapping,
  type HistoricalSaleRecord,
} from "./historicalImports.js";
import type { HistoricalPlayerMapping } from "./platformHistoricalImportWorkflow.js";
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
  LeagueSetupWriteConflictError,
  leagueSeasonSetupRevision,
} from "./leagueSetup.js";
import {
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  type CreateLiveDraftRoomInput,
  type LiveDraftRoom,
  type LiveDraftRoomInitialRosterPlayer,
  type LiveDraftRoomPlayerCatalogEntry,
  type LiveDraftRoomRepository,
  type LiveDraftRoomSaleCommandInput,
} from "./liveDraftRooms.js";
import {
  InMemoryLiveDraftRoomSetupRepository,
  liveDraftRoomSetupContentHash,
  type LiveDraftRoomSetup,
} from "./liveDraftRoomSetups.js";
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
  type FindStoredMockDraftCommandForRetryInput,
  type MockDraftSession,
  type MockDraftModeMetadata,
  type MockDraftResultReference,
  type StoredMockDraftCommandRetry,
} from "./mockSessions.js";
import type { SeasonMockConfigurationSnapshotV1 } from "./seasonMockSnapshot.js";
import {
  InMemorySimulationRepository,
  executeSimulationRun,
  type CreateSimulationRequestInput,
  type SimulationRepository,
  type SimulationMockBatchRunner,
  type SimulationResult,
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
  preflightLeaguePricingWorkflow,
  type PreflightLeaguePricingWorkflowResult,
  type RebuildLeaguePricingWorkflowResult,
} from "./platformPricingWorkflow.js";
import {
  createInMemoryPricingSnapshotRepository,
  type PricingSnapshot,
  type PricingSnapshotRepository,
  type PricingSourcePrice,
} from "./pricingSnapshots.js";
import {
  InMemoryPracticeShortlistRepository,
  type PracticeShortlistItem,
  type PracticeShortlistRepository,
} from "./practiceShortlists.js";
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
  expectedSetupRevision?: string;
  membershipWriteMode?: "replace" | "preserve";
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

export interface ListPracticeShortlistInput {
  actorSessionToken: string;
  seasonId: string;
  now?: Date | undefined;
}

export interface SavePracticeShortlistInput extends ListPracticeShortlistInput {
  playerName: string;
  position: string;
  maxBid?: number | undefined;
}

export interface RemovePracticeShortlistInput extends ListPracticeShortlistInput {
  playerName: string;
}

export interface LogoutInput {
  actorSessionToken: string;
  now?: Date | undefined;
}

export interface ChangePlatformPasswordInput {
  actorSessionToken: string;
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
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

export interface CompletePlatformSeasonSimulationRunInput {
  actorSessionToken: string;
  runId: string;
  result: SimulationResult;
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
  seasonId?: string | undefined;
  historyLimit?: number | undefined;
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
  currentSeasonId?: string | undefined;
  sourceText: string;
  replacementRequested?: boolean | undefined;
  playerCatalog?: readonly HistoricalImportPlayerCatalogEntry[] | undefined;
  ownerMappings?: readonly HistoricalOwnerMapping[] | undefined;
  playerMappings?: readonly HistoricalPlayerMapping[] | undefined;
  now?: Date | undefined;
}

export interface CommitPlatformHistoricalImportInput {
  actorSessionToken: string;
  batchId: string;
  expectedLeagueId?: string | undefined;
  expectedLeagueSeasonId?: string | undefined;
  expectedSeasonYear?: number | undefined;
  now?: Date | undefined;
}

export interface PreparePlatformHistoricalImportCommitInput extends CommitPlatformHistoricalImportInput {
  pricingSeasonYear: number;
}

export interface PreparePlatformHistoricalImportCommitResult {
  batch: HistoricalImportBatch;
  projectedHistoricalSaleRecords: readonly HistoricalSaleRecord[];
}

export interface RebuildPlatformPricingInput {
  actorSessionToken: string;
  leagueId: string;
  seasonYear: number;
  modelVersion: string;
  scenarioIds: readonly string[];
  baselinePrices: readonly PricingSourcePrice[];
  currentKeeperCount?: number | undefined;
  keeperLockedSpend?: number | undefined;
  historicalSaleRecords?: readonly HistoricalSaleRecord[] | undefined;
  now?: Date | undefined;
}

export interface PreflightPlatformPricingInput extends RebuildPlatformPricingInput {}

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
  configurationSnapshot?: SeasonMockConfigurationSnapshotV1 | undefined;
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

export interface FindStoredPlatformMockDraftCommandForRetryInput extends Omit<
  FindStoredMockDraftCommandForRetryInput,
  "userId"
> {
  actorSessionToken: string;
  now?: Date | undefined;
}

export interface ResetPlatformMockDraftSessionInput {
  actorSessionToken: string;
  sessionId: string;
  expectedRevision: number;
  now?: Date | undefined;
}

export interface CompletePlatformMockDraftSessionInput {
  actorSessionToken: string;
  sessionId: string;
  expectedRevision: number;
  latestResultRef?: MockDraftResultReference | undefined;
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

export interface SynchronizePlatformLiveDraftRoomInitialRostersInput {
  actorSessionToken: string;
  seasonId: string;
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  expectedRevision?: number | undefined;
  idempotencyKey: string;
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

export interface EndPlatformLiveDraftRoomInput extends MutatePlatformLiveDraftRoomInput {
  allowIncomplete?: boolean | undefined;
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
  authEmail?: {
    verificationRequired: boolean;
    mailSender?: AuthMailSender | undefined;
    publicBaseUrl?: string | undefined;
  } | undefined;
  leagueSetupRepository?: LeagueSetupRepository | undefined;
  historicalImportRepository?: HistoricalImportRepository | undefined;
  jobRepository?: JobRepository | undefined;
  simulationRepository?: SimulationRepository | undefined;
  practiceShortlistRepository?: PracticeShortlistRepository | undefined;
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
  practiceShortlistItems: readonly PracticeShortlistItem[];
  liveDraftRooms: readonly LiveDraftRoom[];
  liveDraftRoomSetups: readonly LiveDraftRoomSetup[];
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
  readonly practiceShortlists = new InMemoryPracticeShortlistRepository();
  readonly liveDraftRooms: InMemoryLiveDraftRoomRepository;
  readonly liveDraftRoomSetups = new InMemoryLiveDraftRoomSetupRepository();
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
    const currentSeason = this.#leagueSeasonsById.get(input.season.id);
    if (
      input.expectedSetupRevision !== undefined &&
      (currentSeason === undefined || leagueSeasonSetupRevision(currentSeason) !== input.expectedSetupRevision)
    ) {
      throw new LeagueSetupWriteConflictError();
    }
    const storedSeason = cloneForRead(input.season);

    this.#leagueSeasonsById.set(storedSeason.id, storedSeason);

    if (input.membershipWriteMode !== "preserve") {
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
      practiceShortlistItems: this.practiceShortlists.items(),
      liveDraftRooms: this.liveDraftRooms.rooms(),
      liveDraftRoomSetups: this.liveDraftRoomSetups.setups(),
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
    const storedDraftSetups = snapshot.liveDraftRoomSetups ?? [];
    const storedSetupSeasonIds = new Set(storedDraftSetups.map(setup => setup.seasonId));
    const recoveredDraftSetups = snapshot.liveDraftRooms
      .filter(room => !storedSetupSeasonIds.has(room.seasonId))
      .map(room => {
        const input = {
          seasonId: room.seasonId,
          sourceVersion: `recovered-live-room:${room.roomId}`,
          playerCatalog: room.playerCatalog,
          initialRosters: room.initialRosters,
          updatedAt: room.updatedAt,
        };

        return {
          ...input,
          contentHash: liveDraftRoomSetupContentHash(input),
        };
      });
    this.liveDraftRoomSetups.replaceSetups([...storedDraftSetups, ...recoveredDraftSetups]);
    this.mockDraftSessions.replaceSessions(snapshot.mockDraftSessions ?? []);
    this.simulations.replaceRuns(snapshot.simulationRuns ?? []);
    this.practiceShortlists.replaceItems(snapshot.practiceShortlistItems ?? []);
  }

  #syncHistoricalImportSeasons(): void {
    this.historicalImports.replaceLeagueSeasons([...this.#leagueSeasonsById.values()]);
  }
}

export const createPlatformApp = ({
  store = new InMemoryPlatformStore(),
  authRepository,
  authEmail,
  leagueSetupRepository,
  historicalImportRepository,
  jobRepository,
  simulationRepository,
  practiceShortlistRepository,
  liveDraftRoomRepository,
  exportArtifactRepository,
  simulationRunner,
}: PlatformAppOptions) => {
  const runtimeAuthRepository = authRepository ?? store.authRepository;
  const leagueSetup = leagueSetupRepository ?? store;
  const historicalImports = historicalImportRepository ?? store.historicalImports;
  const auth = createAuthService({
    repository: runtimeAuthRepository,
    emailVerificationRequired: authEmail?.verificationRequired ?? false,
    ...(authEmail?.mailSender === undefined ? {} : { mailSender: authEmail.mailSender }),
    ...(authEmail?.publicBaseUrl === undefined ? {} : { publicBaseUrl: authEmail.publicBaseUrl }),
  });
  const jobs = jobRepository ?? store.jobs;
  const simulations = simulationRepository ?? store.simulations;
  const practiceShortlists = practiceShortlistRepository ?? store.practiceShortlists;
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

    requestEmailVerification: async (
      input: RequestEmailVerificationInput,
    ): Promise<AcceptedAuthRequest> => await auth.requestEmailVerification(input),

    verifyEmail: async (input: VerifyEmailInput): Promise<AccountRecord> =>
      cloneForRead(await auth.verifyEmail(input)),

    requestPasswordReset: async (
      input: RequestPasswordResetInput,
    ): Promise<AcceptedAuthRequest> => await auth.requestPasswordReset(input),

    resetPasswordWithToken: async (
      input: ResetPasswordWithTokenInput,
    ): Promise<PasswordReplacementResult> => cloneForRead(await auth.resetPasswordWithToken(input)),

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

    changePassword: async (input: ChangePlatformPasswordInput): Promise<PasswordReplacementResult> =>
      cloneForRead(await auth.changePassword({
        sessionToken: input.actorSessionToken,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        newPasswordConfirmation: input.newPasswordConfirmation,
        now: input.now,
      })),

    listLeagueMemberships: async (leagueId: string): Promise<readonly PlatformLeagueMembership[]> =>
      cloneForRead(await leagueSetup.membershipsForLeague(leagueId)),

    registerLeagueSeason: async (input: RegisterLeagueSeasonInput): Promise<LeagueSeason> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      await assertSeasonRegistrationAllowed(account, input.season, input.memberships);
      const registeredSeason = await leagueSetup.registerLeagueSeason({
        season: input.season,
        memberships: input.memberships,
        createdByUserId: account.id,
        ...(input.expectedSetupRevision === undefined
          ? {}
          : { expectedSetupRevision: input.expectedSetupRevision }),
        ...(input.membershipWriteMode === undefined
          ? {}
          : { membershipWriteMode: input.membershipWriteMode }),
        now: input.now,
      });
      if (usesExternalLeagueSetup) {
        store.registerLeagueSeason({
          season: registeredSeason,
          memberships: input.memberships,
          createdByUserId: account.id,
          ...(input.membershipWriteMode === undefined
            ? {}
            : { membershipWriteMode: input.membershipWriteMode }),
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

    listPracticeShortlist: async (
      input: ListPracticeShortlistInput,
    ): Promise<readonly PracticeShortlistItem[]> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      await requireSeasonRead(account, input.seasonId);

      return cloneForRead(await practiceShortlists.listForUserSeason(account.id, input.seasonId));
    },

    savePracticeShortlistItem: async (
      input: SavePracticeShortlistInput,
    ): Promise<PracticeShortlistItem> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const season = await requireSeasonRead(account, input.seasonId);

      return cloneForRead(await practiceShortlists.save({
        leagueId: season.leagueId,
        seasonId: season.id,
        userId: account.id,
        playerName: input.playerName,
        position: input.position,
        ...(input.maxBid === undefined ? {} : { maxBid: input.maxBid }),
        now: input.now,
      }));
    },

    removePracticeShortlistItem: async (
      input: RemovePracticeShortlistInput,
    ): Promise<boolean> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      await requireSeasonRead(account, input.seasonId);

      return await practiceShortlists.remove(account.id, input.seasonId, input.playerName);
    },

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

    completeSeasonSimulationRun: async (
      input: CompletePlatformSeasonSimulationRunInput,
    ): Promise<SimulationRun> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const run = await simulations.fetchForUser(input.runId, account.id);
      if (run === null) {
        throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
      }
      await requirePrivateTeamContext(account, run.request);
      await simulations.markRunning(run.id, input.now ?? new Date());

      try {
        return cloneForRead(await simulations.complete(run.id, input.result));
      } catch (error) {
        try {
          await simulations.markFailed(run.id);
        } catch {
          // Preserve the completion error while making a best effort to record failure.
        }
        throw error;
      }
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

      const runs = input.seasonId === undefined
        ? await simulations.listForUser(account.id)
        : await simulations.listHistoryForUserSeason(account.id, input.seasonId, input.historyLimit ?? 25);
      const readableRuns: SimulationRun[] = [];
      for (const run of runs) {
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
      const currentLeagueSeason = input.currentSeasonId === undefined
        ? await requireSeasonForLeagueYear(input.leagueId, input.seasonYear)
        : await requireSeason(input.currentSeasonId);
      if (currentLeagueSeason.leagueId !== input.leagueId) {
        throw new PlatformAppError("season_not_found", "League season was not found.");
      }
      await requireSharedMutation(account, input.leagueId);

      return cloneForRead(await previewHistoricalImportSourceWorkflow({
        repository: historicalImports,
        leagueId: input.leagueId,
        seasonYear: input.seasonYear,
        ...(input.currentSeasonId === undefined
          ? {}
          : { seasonContext: { currentLeagueSeason } }),
        sourceText: input.sourceText,
        uploadedByUserId: account.id,
        ...(input.replacementRequested === undefined ? {} : { replacementRequested: input.replacementRequested }),
        ...(input.playerCatalog === undefined ? {} : { playerCatalog: input.playerCatalog }),
        ...(input.ownerMappings === undefined ? {} : { ownerMappings: input.ownerMappings }),
        ...(input.playerMappings === undefined ? {} : { playerMappings: input.playerMappings }),
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
        ...(input.expectedLeagueId === undefined ? {} : { expectedLeagueId: input.expectedLeagueId }),
        ...(input.expectedLeagueSeasonId === undefined
          ? {}
          : { expectedLeagueSeasonId: input.expectedLeagueSeasonId }),
        ...(input.expectedSeasonYear === undefined ? {} : { expectedSeasonYear: input.expectedSeasonYear }),
        ...(input.now === undefined ? {} : { now: input.now }),
      }));
    },

    prepareHistoricalImportCommit: async (
      input: PreparePlatformHistoricalImportCommitInput,
    ): Promise<PreparePlatformHistoricalImportCommitResult> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const prepared = await prepareHistoricalImportBatchCommit({
        repository: historicalImports,
        batchId: input.batchId,
        ...(input.expectedLeagueId === undefined ? {} : { expectedLeagueId: input.expectedLeagueId }),
        ...(input.expectedLeagueSeasonId === undefined
          ? {}
          : { expectedLeagueSeasonId: input.expectedLeagueSeasonId }),
        ...(input.expectedSeasonYear === undefined ? {} : { expectedSeasonYear: input.expectedSeasonYear }),
      });
      await requireSharedMutation(account, prepared.batch.leagueId);
      const currentRecords = await historicalImports.currentRecordsThroughSeason(
        prepared.batch.leagueId,
        input.pricingSeasonYear,
      );

      return cloneForRead({
        batch: prepared.batch,
        projectedHistoricalSaleRecords: [
          ...currentRecords.filter(record => record.seasonYear !== prepared.batch.seasonYear),
          ...prepared.committedRecords,
        ],
      });
    },

    preflightLeaguePricing: async (
      input: PreflightPlatformPricingInput,
    ): Promise<PreflightLeaguePricingWorkflowResult> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const season = await requireSeasonForLeagueYear(input.leagueId, input.seasonYear);
      await requireSharedMutation(account, input.leagueId);
      if (season.settings.draftFormat === "snake") {
        throw new PlatformAppError(
          "shared_mutation_denied",
          "Auction price rebuilding is not available for snake league seasons.",
        );
      }
      const historicalSaleRecords = input.historicalSaleRecords
        ?? await historicalImports.currentRecordsThroughSeason(input.leagueId, input.seasonYear);

      return cloneForRead(preflightLeaguePricingWorkflow({
        repository: store.pricingSnapshots,
        leagueId: input.leagueId,
        seasonYear: input.seasonYear,
        modelVersion: input.modelVersion,
        scenarioIds: input.scenarioIds,
        baselinePrices: input.baselinePrices,
        historicalSaleRecords,
        currentAuctionBudget: season.settings.auction.budgetDollars,
        currentTeamCount: season.teams.length,
        currentRosterSize: season.settings.roster.rosterSize,
        currentMinimumBidDollars: season.settings.auction.minimumBidDollars,
        currentKeeperCount: input.currentKeeperCount ?? 0,
        keeperLockedSpend: input.keeperLockedSpend ?? 0,
        ...(input.now === undefined ? {} : { createdAt: input.now.toISOString() }),
      }));
    },

    rebuildLeaguePricing: async (
      input: RebuildPlatformPricingInput,
    ): Promise<RebuildLeaguePricingWorkflowResult> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const season = await requireSeasonForLeagueYear(input.leagueId, input.seasonYear);
      await requireSharedMutation(account, input.leagueId);

      const historicalSaleRecords = input.historicalSaleRecords
        ?? await historicalImports.currentRecordsThroughSeason(input.leagueId, input.seasonYear);
      if (season.settings.draftFormat === "snake") {
        throw new PlatformAppError(
          "shared_mutation_denied",
          "Auction price rebuilding is not available for snake league seasons.",
        );
      }

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
        currentRosterSize: season.settings.roster.rosterSize,
        currentMinimumBidDollars: season.settings.auction.minimumBidDollars,
        currentKeeperCount: input.currentKeeperCount ?? 0,
        keeperLockedSpend: input.keeperLockedSpend ?? 0,
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
        configurationSnapshot: input.configurationSnapshot,
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

    findStoredMockDraftCommandForRetry: async (
      input: FindStoredPlatformMockDraftCommandForRetryInput,
    ): Promise<StoredMockDraftCommandRetry | undefined> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const session = store.mockDraftSessions.getSession({ userId: account.id, sessionId: input.sessionId });
      await requirePrivateTeamContext(account, session);
      const retry = store.mockDraftSessions.findStoredCommandForRetry({
        userId: account.id,
        sessionId: input.sessionId,
        commandId: input.commandId,
        command: input.command,
        idempotencyKey: input.idempotencyKey,
      });

      return retry === undefined ? undefined : cloneForRead(retry);
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

    completeMockDraftSession: async (
      input: CompletePlatformMockDraftSessionInput,
    ): Promise<MockDraftSession> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const session = store.mockDraftSessions.getSession({ userId: account.id, sessionId: input.sessionId });
      await requirePrivateTeamContext(account, session);
      const latestResultRef = await requireReadableMockDraftResultReference(account, input.latestResultRef);

      return cloneForRead(store.mockDraftSessions.markCompleted({
        userId: account.id,
        sessionId: input.sessionId,
        expectedRevision: input.expectedRevision,
        latestResultRef,
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

    hasLiveDraftRoomForSeason: async (seasonId: string): Promise<boolean> =>
      await liveDraftRooms.hasRoomForSeason(seasonId),

    hasStartedLiveDraftRoomForSeason: async (seasonId: string): Promise<boolean> =>
      await liveDraftRooms.hasStartedRoomForSeason(seasonId),

    synchronizeLiveDraftRoomInitialRosters: async (
      input: SynchronizePlatformLiveDraftRoomInitialRostersInput,
    ): Promise<LiveDraftRoom | null> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const season = await requireSeason(input.seasonId);
      const membership = await requireSharedMutation(account, season.leagueId);

      const room = await liveDraftRooms.synchronizeInitialRostersForSeason({
        seasonId: season.id,
        actor: liveActorFor(account, season.leagueId, membership),
        initialRosters: cloneForRead(input.initialRosters),
        playerCatalog: cloneForRead(input.playerCatalog),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      });

      return room === null ? null : cloneForRead(room);
    },

    cancelLiveDraftRoom: async (input: MutatePlatformLiveDraftRoomInput): Promise<void> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      let room: LiveDraftRoom;
      try {
        room = await liveDraftRooms.getRoom(input.roomId);
      } catch (error) {
        if (error instanceof LiveDraftRoomError && error.code === "room_not_found") {
          await liveDraftRooms.cancelRoom({
            roomId: input.roomId,
            actor: { userId: account.id, leagueId: "" },
            expectedRevision: input.expectedRevision,
            idempotencyKey: input.idempotencyKey,
            now: input.now,
          });
          return;
        }
        throw error;
      }
      const membership = await requireSharedMutation(account, room.leagueId);

      await liveDraftRooms.cancelRoom({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        now: input.now,
      });
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

    endLiveDraftRoom: async (input: EndPlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
      const account = await requireAccount(input.actorSessionToken, input.now);
      const room = await liveDraftRooms.getRoom(input.roomId);
      const membership = await requireSharedMutation(account, room.leagueId);

      return cloneForRead(await liveDraftRooms.endRoom({
        roomId: input.roomId,
        actor: liveActorFor(account, room.leagueId, membership),
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        allowIncomplete: input.allowIncomplete,
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
      await requireSharedMutation(account, room.leagueId);
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
