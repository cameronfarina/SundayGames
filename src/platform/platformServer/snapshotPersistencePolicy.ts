import type { PlatformHttpRequest } from "../platformHttp.js";
import type { PlatformRuntime } from "./internalContracts.js";
import {
  isExportArtifactOnlyMutationRequest,
  isJobAndSimulationOnlyMutationRequest,
  isJobOnlyMutationRequest,
  isLeagueMembersScreenshotAnalysisRequest,
  isLiveDraftRoomOnlyMutationRequest,
  isPracticeShortlistOnlyMutationRequest,
  isSeasonSimulationRequest,
  isSimulationOnlyMutationRequest,
} from "./requestKinds.js";
import {
  isAuthOnlyMutationRequest,
  isHistoricalImportOnlyMutationRequest,
  isLeagueSetupOnlyMutationRequest,
} from "./repositoryRequestKinds.js";

export const usesFileAuthSidecarFor = (
  runtime: PlatformRuntime,
  request: PlatformHttpRequest,
): boolean => runtime.fileStore !== undefined && isAuthOnlyMutationRequest(request);

export const shouldSkipSnapshotPersist = (
  runtime: PlatformRuntime,
  request: PlatformHttpRequest,
): boolean => {
  const externalAuth = runtime.authRepository !== runtime.store.authRepository;
  const externalLeagueSetup = runtime.leagueSetupRepository !== runtime.store;
  const externalHistoricalImports = runtime.historicalImportRepository !== runtime.store.historicalImports;
  const externalJobs = runtime.jobRepository !== runtime.store.jobs;
  const externalSimulations = runtime.simulationRepository !== runtime.store.simulations;
  const externalShortlist = runtime.practiceShortlistRepository !== runtime.store.practiceShortlists;
  const externalLiveRooms = runtime.liveDraftRoomRepository !== runtime.store.liveDraftRooms;
  const externalExports = runtime.exportArtifactRepository !== runtime.store.exportArtifacts;
  return isLeagueMembersScreenshotAnalysisRequest(request) ||
    isSeasonSimulationRequest(request) ||
    usesFileAuthSidecarFor(runtime, request) ||
    (externalAuth && isAuthOnlyMutationRequest(request)) ||
    (externalLeagueSetup && isLeagueSetupOnlyMutationRequest(request)) ||
    (externalHistoricalImports && isHistoricalImportOnlyMutationRequest(request)) ||
    (externalJobs && isJobOnlyMutationRequest(request)) ||
    (externalSimulations && isSimulationOnlyMutationRequest(request)) ||
    (externalShortlist && isPracticeShortlistOnlyMutationRequest(request)) ||
    (externalJobs && externalSimulations && isJobAndSimulationOnlyMutationRequest(request)) ||
    (externalLiveRooms && isLiveDraftRoomOnlyMutationRequest(request)) ||
    (externalExports && isExportArtifactOnlyMutationRequest(request));
};
