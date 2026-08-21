import type { InMemoryPlatformStoreSnapshot } from "../../contracts/store.js";
import { cloneForRead } from "../../shared.js";
import {
  leagueMemorySnapshot,
  type LeagueMemoryState,
} from "../leagueMemoryState.js";
import type { SnapshotRepositories } from "../loadStoreSnapshot.js";

export const createAuthSnapshot = (
  repositories: SnapshotRepositories,
): InMemoryPlatformStoreSnapshot["auth"] => ({
  accountCredentials: repositories.authRepository.accounts().map(account => {
    const credential = repositories.authRepository.findAccountCredentialByEmail(account.email);
    if (credential === null) throw new Error(`Missing credential for account "${account.id}".`);
    return cloneForRead(credential);
  }),
  sessions: repositories.authRepository.sessions().map(cloneForRead),
});

export const createOnboardingSnapshot = (
  state: LeagueMemoryState,
  repositories: SnapshotRepositories,
) => ({
  ...leagueMemorySnapshot(state),
  liveDraftRooms: repositories.liveDraftRooms.roomSummaries(),
});

export const createStoreSnapshot = (
  state: LeagueMemoryState,
  repositories: SnapshotRepositories,
): InMemoryPlatformStoreSnapshot => ({
  auth: createAuthSnapshot(repositories),
  accountOnboardingProfiles: repositories.accountOnboarding.records(),
  ...leagueMemorySnapshot(state),
  mockDraftSessions: repositories.mockDraftSessions.sessions(),
  simulationRuns: repositories.simulations.runs(),
  practiceShortlistItems: repositories.practiceShortlists.items(),
  liveDraftRooms: repositories.liveDraftRooms.rooms(),
  liveDraftRoomSetups: repositories.liveDraftRoomSetups.setups(),
  historicalImportBatches: repositories.historicalImports.batches(),
  historicalSaleRecords: repositories.historicalImports.records(),
  pricingSnapshots: repositories.pricingSnapshots.list(),
  jobs: repositories.jobs.jobs(),
  exportArtifacts: repositories.exportArtifacts.artifacts(),
  exportArtifactContents: repositories.exportArtifacts.contents(),
});
