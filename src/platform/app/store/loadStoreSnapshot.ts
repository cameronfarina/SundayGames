import type { InMemoryAuthRepository } from "../../auth.js";
import type { InMemoryAccountOnboardingRepository } from "../../accountOnboarding.js";
import type { InMemoryExportArtifactRepository } from "../../exportArtifacts.js";
import type { InMemoryHistoricalImportRepository } from "../../historicalImports.js";
import type { InMemoryJobQueue } from "../../jobs.js";
import {
  liveDraftRoomSetupContentHash,
  type InMemoryLiveDraftRoomSetupRepository,
} from "../../liveDraftRoomSetups.js";
import type { InMemoryLiveDraftRoomRepository } from "../../liveDraftRooms.js";
import type { InMemoryMockDraftSessionRepository } from "../../mockSessions.js";
import type { InMemoryPracticeShortlistRepository } from "../../practiceShortlists.js";
import type { PricingSnapshotRepository } from "../../pricingSnapshots.js";
import type { InMemorySimulationRepository } from "../../simulations.js";
import type { InMemoryPlatformStoreSnapshot } from "../contracts/store.js";
import {
  recoverMissingLeagueCreationRecords,
  restoreLeagueMemoryState,
  type LeagueMemoryState,
} from "./leagueMemoryState.js";

export interface SnapshotRepositories {
  readonly accountOnboarding: InMemoryAccountOnboardingRepository;
  readonly authRepository: InMemoryAuthRepository;
  readonly exportArtifacts: InMemoryExportArtifactRepository;
  readonly historicalImports: InMemoryHistoricalImportRepository;
  readonly jobs: InMemoryJobQueue;
  readonly liveDraftRooms: InMemoryLiveDraftRoomRepository;
  readonly liveDraftRoomSetups: InMemoryLiveDraftRoomSetupRepository;
  readonly mockDraftSessions: InMemoryMockDraftSessionRepository;
  readonly practiceShortlists: InMemoryPracticeShortlistRepository;
  readonly pricingSnapshots: PricingSnapshotRepository;
  readonly simulations: InMemorySimulationRepository;
}

const restoreAuth = (
  repository: InMemoryAuthRepository,
  snapshot: InMemoryPlatformStoreSnapshot["auth"],
): void => {
  for (const credential of snapshot.accountCredentials) {
    const account = repository.createAccount({
      id: credential.account.id,
      email: credential.account.email,
      passwordHash: credential.passwordHash,
      now: credential.account.createdAt,
    });
    account.updatedAt = credential.account.updatedAt;
  }
  for (const session of snapshot.sessions) {
    repository.createSession({
      id: session.id,
      accountId: session.accountId,
      tokenHash: session.tokenHash,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    });
    if (session.revokedAt !== undefined) repository.revokeSession(session.id, session.revokedAt);
  }
};

const recoverLiveDraftSetups = (
  repositories: SnapshotRepositories,
  snapshot: InMemoryPlatformStoreSnapshot,
): void => {
  repositories.liveDraftRooms.replaceRooms(snapshot.liveDraftRooms);
  const storedSetups = snapshot.liveDraftRoomSetups ?? [];
  const setupSeasonIds = new Set(storedSetups.map(setup => setup.seasonId));
  const recoveredSetups = snapshot.liveDraftRooms
    .filter(room => !setupSeasonIds.has(room.seasonId))
    .map(room => {
      const input = {
        seasonId: room.seasonId,
        sourceVersion: `recovered-live-room:${room.roomId}`,
        playerCatalog: room.playerCatalog,
        initialRosters: room.initialRosters,
        updatedAt: room.updatedAt,
      };
      return { ...input, contentHash: liveDraftRoomSetupContentHash(input) };
    });
  repositories.liveDraftRoomSetups.replaceSetups([...storedSetups, ...recoveredSetups]);
};

export const loadStoreSnapshot = (
  state: LeagueMemoryState,
  repositories: SnapshotRepositories,
  snapshot: InMemoryPlatformStoreSnapshot,
): void => {
  const accountOnboardingProfiles = snapshot.accountOnboardingProfiles ??
    snapshot.auth.accountCredentials.map(credential => ({
      accountId: credential.account.id,
      intent: null,
      providers: null,
      completedAt: credential.account.createdAt,
      createdAt: credential.account.createdAt,
      updatedAt: credential.account.updatedAt,
    }));
  repositories.accountOnboarding.replaceRecords(accountOnboardingProfiles);
  restoreAuth(repositories.authRepository, snapshot.auth);
  restoreLeagueMemoryState(state, {
    leagueSeasons: snapshot.leagueSeasons,
    leagueCreationRecords: snapshot.leagueCreationRecords ?? [],
    memberships: snapshot.memberships,
  });
  recoverMissingLeagueCreationRecords(state);
  repositories.historicalImports.replaceLeagueSeasons([...state.seasonsById.values()]);
  repositories.historicalImports.replaceBatchesAndRecords(
    snapshot.historicalImportBatches ?? [],
    snapshot.historicalSaleRecords ?? [],
  );
  for (const pricingSnapshot of snapshot.pricingSnapshots ?? []) {
    repositories.pricingSnapshots.save(pricingSnapshot);
  }
  repositories.jobs.replaceJobs(snapshot.jobs ?? []);
  repositories.exportArtifacts.replaceArtifactsAndContents(
    snapshot.exportArtifacts ?? [],
    snapshot.exportArtifactContents ?? [],
  );
  recoverLiveDraftSetups(repositories, snapshot);
  repositories.mockDraftSessions.replaceSessions(snapshot.mockDraftSessions ?? []);
  repositories.simulations.replaceRuns(snapshot.simulationRuns ?? []);
  repositories.practiceShortlists.replaceItems(snapshot.practiceShortlistItems ?? []);
};
