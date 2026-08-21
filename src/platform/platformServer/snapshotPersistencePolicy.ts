import type { PlatformHttpRequest } from "../platformHttp.js";
import type { PlatformRuntime } from "./internalContracts.js";
import {
  isExportArtifactOnlyMutationRequest,
  isJobAndSimulationOnlyMutationRequest,
  isJobRequest,
  isJobOnlyMutationRequest,
  isLeagueConnectionImportRequest,
  isLeagueConnectionOnlyMutationRequest,
  isLeagueConnectionSyncRequest,
  isLeagueMembersScreenshotAnalysisRequest,
  isLiveDraftRoomOnlyMutationRequest,
  isMockDraftSessionOnlyMutationRequest,
  isMockDraftSessionRequest,
  isPracticeShortlistOnlyMutationRequest,
  isPracticeShortlistRequest,
  isSeasonSimulationRequest,
  isSeasonSimulationOutcomeMutationRequest,
  isSeasonSimulationResourceRequest,
  isSimulationRequest,
  isSimulationOnlyMutationRequest,
} from "./requestKinds.js";
import {
  isAccountOnboardingOnlyMutationRequest,
  isAuthOnlyMutationRequest,
  isHistoricalImportOnlyMutationRequest,
  isLeagueSetupOnlyMutationRequest,
} from "./repositoryRequestKinds.js";

export const usesFileAuthSidecarFor = (
  runtime: PlatformRuntime,
  request: PlatformHttpRequest,
): boolean => runtime.fileStore !== undefined && isAuthOnlyMutationRequest(request);

export const requiresAtomicPracticeDualWrite = (
  runtime: PlatformRuntime,
  request: PlatformHttpRequest,
): boolean => runtime.mockDraftPersistenceMode === "dual-write" &&
  isMockDraftSessionOnlyMutationRequest(request);

export const shouldSkipSnapshotPersist = (
  runtime: PlatformRuntime,
  request: PlatformHttpRequest,
): boolean => {
  const externalAuth = runtime.authRepository !== runtime.store.authRepository;
  const externalAccountOnboarding =
    runtime.accountOnboardingRepository !== runtime.store.accountOnboarding;
  const externalLeagueSetup = runtime.leagueSetupRepository !== runtime.store;
  const externalHistoricalImports = runtime.historicalImportRepository !== runtime.store.historicalImports;
  const externalJobs = runtime.jobRepository !== runtime.store.jobs;
  const externalSimulations = runtime.simulationRepository !== runtime.store.simulations;
  const externalShortlist = runtime.practiceShortlistRepository !== runtime.store.practiceShortlists;
  const normalizedOnlyMockSessions = runtime.mockDraftPersistenceMode === "normalized-only";
  const externalLiveRooms = runtime.liveDraftRoomRepository !== runtime.store.liveDraftRooms;
  const externalExports = runtime.exportArtifactRepository !== runtime.store.exportArtifacts;
  return isLeagueMembersScreenshotAnalysisRequest(request) ||
    isSeasonSimulationRequest(request) ||
    usesFileAuthSidecarFor(runtime, request) ||
    (externalAccountOnboarding && isAccountOnboardingOnlyMutationRequest(request)) ||
    (externalAuth && isAuthOnlyMutationRequest(request)) ||
    (externalLeagueSetup && isLeagueSetupOnlyMutationRequest(request)) ||
    (externalHistoricalImports && isHistoricalImportOnlyMutationRequest(request)) ||
    (externalJobs && isJobOnlyMutationRequest(request)) ||
    (externalSimulations && isSimulationOnlyMutationRequest(request)) ||
    (externalSimulations && isSeasonSimulationOutcomeMutationRequest(request)) ||
    (externalShortlist && isPracticeShortlistOnlyMutationRequest(request)) ||
    (normalizedOnlyMockSessions && isMockDraftSessionOnlyMutationRequest(request)) ||
    (externalJobs && externalSimulations && isJobAndSimulationOnlyMutationRequest(request)) ||
    (externalLiveRooms && isLiveDraftRoomOnlyMutationRequest(request)) ||
    (externalExports && isExportArtifactOnlyMutationRequest(request)) ||
    shouldBypassSnapshotAccess(runtime, request);
};

export const shouldBypassSnapshotAccess = (
  runtime: PlatformRuntime,
  request: PlatformHttpRequest,
): boolean => {
  const externalJobs = runtime.jobRepository !== runtime.store.jobs;
  const externalSimulations = runtime.simulationRepository !== runtime.store.simulations;
  const externalShortlist = runtime.practiceShortlistRepository !== runtime.store.practiceShortlists;
  const normalizedOnlyMockSessions = runtime.mockDraftPersistenceMode === "normalized-only";
  if (isSeasonSimulationResourceRequest(request)) return true;
  if (externalShortlist && isPracticeShortlistRequest(request)) return true;
  if (normalizedOnlyMockSessions && isMockDraftSessionRequest(request)) return true;
  if (isSimulationRequest(request)) {
    return isJobOnlyMutationRequest(request) ? externalJobs : externalSimulations;
  }
  if (isJobRequest(request)) {
    return isJobAndSimulationOnlyMutationRequest(request)
      ? externalJobs && externalSimulations
      : externalJobs;
  }

  const externalLeagueConnections =
    runtime.leagueConnectionRepository !== runtime.store.leagueConnections;
  if (!externalLeagueConnections) return false;
  if (isLeagueConnectionOnlyMutationRequest(request)) return true;

  const externalLeagueSetup = runtime.leagueSetupRepository !== runtime.store;
  return externalLeagueSetup &&
    (isLeagueConnectionSyncRequest(request) || isLeagueConnectionImportRequest(request));
};
