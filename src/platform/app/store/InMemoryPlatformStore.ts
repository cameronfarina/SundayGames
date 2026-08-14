import { InMemoryAuthRepository } from "../../auth.js";
import { InMemoryExportArtifactRepository } from "../../exportArtifacts.js";
import { InMemoryHistoricalImportRepository } from "../../historicalImports.js";
import { InMemoryJobQueue } from "../../jobs.js";
import type { LeagueSeason } from "../../leagueSeason.js";
import type {
  ArchiveLeagueRepositoryInput,
  ClaimLeagueSeasonTeamRepositoryInput,
  JoinLeagueSeasonTeamRepositoryInput,
  LeagueSetupRepository,
  PlatformLeagueMembership,
  RegisterLeagueSeasonRepositoryInput,
} from "../../leagueSetup.js";
import { InMemoryLiveDraftRoomRepository } from "../../liveDraftRooms.js";
import { InMemoryLiveDraftRoomSetupRepository } from "../../liveDraftRoomSetups.js";
import { InMemoryMockDraftSessionRepository } from "../../mockSessions.js";
import { InMemoryPracticeShortlistRepository } from "../../practiceShortlists.js";
import {
  createInMemoryPricingSnapshotRepository,
  type PricingSnapshotRepository,
} from "../../pricingSnapshots.js";
import { InMemorySimulationRepository } from "../../simulations.js";
import type {
  InMemoryPlatformStoreOptions,
  InMemoryPlatformStoreSnapshot,
} from "../contracts/store.js";
import { cloneForRead } from "../shared.js";
import {
  createLeagueMemoryState,
  leagueMemorySnapshot,
  type LeagueMemoryState,
} from "./leagueMemoryState.js";
import { archiveLeague, registerLeagueSeason } from "./leagueRegistration.js";
import { loadStoreSnapshot } from "./loadStoreSnapshot.js";
import {
  claimLeagueSeasonTeam,
  joinLeagueSeasonTeam,
  replaceLeagueMemberships,
} from "./teamMemberships.js";

const mutationRoles = new Set(["owner", "admin"]);

export class InMemoryPlatformStore implements LeagueSetupRepository {
  readonly authRepository = new InMemoryAuthRepository();
  readonly exportArtifacts = new InMemoryExportArtifactRepository();
  readonly historicalImports = new InMemoryHistoricalImportRepository();
  readonly jobs = new InMemoryJobQueue();
  readonly mockDraftSessions: InMemoryMockDraftSessionRepository;
  readonly pricingSnapshots: PricingSnapshotRepository = createInMemoryPricingSnapshotRepository();
  readonly simulations = new InMemorySimulationRepository();
  readonly practiceShortlists = new InMemoryPracticeShortlistRepository();
  readonly liveDraftRooms: InMemoryLiveDraftRoomRepository;
  readonly liveDraftRoomSetups = new InMemoryLiveDraftRoomSetupRepository();
  readonly #leagueState: LeagueMemoryState;

  constructor(
    snapshot?: InMemoryPlatformStoreSnapshot | undefined,
    options: InMemoryPlatformStoreOptions = {},
  ) {
    this.#leagueState = createLeagueMemoryState(options.leagueCreationLimits);
    this.mockDraftSessions = new InMemoryMockDraftSessionRepository(
      [],
      options.mockDraftSessionResourcePolicy,
    );
    this.liveDraftRooms = new InMemoryLiveDraftRoomRepository(({ actor, action, room }) => {
      const membership = this.findMembership(actor.userId, room.leagueId);
      if (actor.leagueId !== room.leagueId || membership === null) return false;
      return action === "read" || mutationRoles.has(membership.role);
    });
    if (snapshot !== undefined) loadStoreSnapshot(this.#leagueState, this, snapshot);
  }

  registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput): LeagueSeason {
    const season = registerLeagueSeason(this.#leagueState, input);
    this.historicalImports.replaceLeagueSeasons([...this.#leagueState.seasonsById.values()]);
    return season;
  }

  archiveLeague(input: ArchiveLeagueRepositoryInput): boolean {
    return archiveLeague(this.#leagueState, input);
  }

  isLeagueArchived(leagueId: string): boolean {
    return this.#leagueState.creationRecordsByLeagueId.get(leagueId)?.archivedAt !== undefined;
  }

  claimLeagueSeasonTeam(input: ClaimLeagueSeasonTeamRepositoryInput): PlatformLeagueMembership | null {
    return claimLeagueSeasonTeam(this.#leagueState, input);
  }

  joinLeagueSeasonTeam(input: JoinLeagueSeasonTeamRepositoryInput): PlatformLeagueMembership | null {
    return joinLeagueSeasonTeam(this.#leagueState, input);
  }

  findLeagueSeason(seasonId: string): LeagueSeason | null {
    const season = this.#leagueState.seasonsById.get(seasonId);
    return season === undefined ? null : cloneForRead(season);
  }

  hasLeagueSeasonForLeague(leagueId: string): boolean {
    return [...this.#leagueState.seasonsById.values()].some(season => season.leagueId === leagueId);
  }

  findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number): LeagueSeason | null {
    const season = [...this.#leagueState.seasonsById.values()].find(
      candidate => candidate.leagueId === leagueId && candidate.seasonYear === seasonYear,
    );
    return season === undefined ? null : cloneForRead(season);
  }

  findMembership(userId: string, leagueId: string): PlatformLeagueMembership | null {
    const membership = [...this.#leagueState.membershipsByUserAndLeague.values()].find(
      candidate => candidate.userId === userId && candidate.leagueId === leagueId,
    );
    return membership === undefined ? null : cloneForRead(membership);
  }

  membershipsForLeague(leagueId: string): readonly PlatformLeagueMembership[] {
    return [...this.#leagueState.membershipsByUserAndLeague.values()]
      .filter(membership => membership.leagueId === leagueId)
      .map(cloneForRead);
  }

  replaceMembershipsForLeague(leagueId: string, memberships: readonly PlatformLeagueMembership[]): void {
    replaceLeagueMemberships(this.#leagueState, leagueId, memberships);
  }

  clearAuthSnapshotState(): void {
    this.authRepository.clear();
  }

  clearHistoricalImportSnapshotState(): void {
    this.historicalImports.replaceBatchesAndRecords([], []);
  }

  authSnapshot(): InMemoryPlatformStoreSnapshot["auth"] {
    return {
      accountCredentials: this.authRepository.accounts().map(account => {
        const credential = this.authRepository.findAccountCredentialByEmail(account.email);
        if (credential === null) throw new Error(`Missing credential for account "${account.id}".`);
        return cloneForRead(credential);
      }),
      sessions: this.authRepository.sessions().map(cloneForRead),
    };
  }

  onboardingSnapshot() {
    const league = leagueMemorySnapshot(this.#leagueState);
    return { ...league, liveDraftRooms: this.liveDraftRooms.roomSummaries() };
  }

  snapshot(): InMemoryPlatformStoreSnapshot {
    const league = leagueMemorySnapshot(this.#leagueState);
    return {
      auth: this.authSnapshot(),
      ...league,
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
}
