import { InMemoryPlatformInvitationRepository } from "../platformInvitations.js";
import { InMemoryPlatformOnboardingRepository, PostgresPlatformOnboardingRepository } from "../platformOnboarding.js";
import { PostgresAuthRepository } from "../postgresAuth.js";
import { PostgresExportArtifactRepository } from "../postgresExportArtifacts.js";
import { PostgresHistoricalImportRepository } from "../postgresHistoricalImports.js";
import { PostgresJobQueue } from "../postgresJobQueue.js";
import { PostgresLeagueSetupRepository } from "../postgresLeagueSetup.js";
import { PostgresLiveDraftRoomRepository } from "../postgresLiveDraftRooms.js";
import { PostgresPlatformInvitationRepository } from "../postgresPlatformInvitations.js";
import { PostgresPracticeShortlistRepository } from "../postgresPracticeShortlists.js";
import { PostgresSimulationRepository } from "../postgresSimulations.js";
import { PostgresLiveDraftRoomSetupRepository } from "../liveDraftRoomSetups.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import type { LoadedPlatformStore, RuntimeRepositories } from "./internalContracts.js";
import { isTransactionalPostgresClient } from "./postgres.js";

export const composeRuntimeRepositories = (
  options: CreatePlatformServerOptions,
  loaded: LoadedPlatformStore,
): RuntimeRepositories => {
  const { store } = loaded;
  const postgresAuthRepository = options.postgresAuthClient === undefined
    ? undefined : new PostgresAuthRepository(options.postgresAuthClient);
  const postgresLeagueSetupRepository = options.postgresLeagueSetupClient === undefined
    ? undefined : new PostgresLeagueSetupRepository(options.postgresLeagueSetupClient);
  const postgresHistoricalImportRepository = options.postgresHistoricalImportClient === undefined
    ? undefined : new PostgresHistoricalImportRepository(options.postgresHistoricalImportClient);
  const postgresJobQueue = options.postgresJobClient === undefined
    ? undefined : new PostgresJobQueue(options.postgresJobClient);
  const postgresSimulationRepository = options.postgresSimulationClient === undefined
    ? undefined : new PostgresSimulationRepository(options.postgresSimulationClient);
  const sharedTransactionalClient = options.postgresClient !== undefined &&
      isTransactionalPostgresClient(options.postgresClient)
    ? options.postgresClient
    : undefined;
  const postgresPracticeShortlistRepository = options.practiceShortlistRepository === undefined &&
      sharedTransactionalClient !== undefined
    ? new PostgresPracticeShortlistRepository(sharedTransactionalClient)
    : undefined;
  const liveDraftClient = options.postgresLiveDraftRoomClient ??
    (options.liveDraftRoomRepository === undefined ? sharedTransactionalClient : undefined);
  const exportArtifactClient = options.postgresExportArtifactClient ??
    (options.exportArtifactRepository === undefined ? sharedTransactionalClient : undefined);
  const postgresLiveDraftRoomRepository = liveDraftClient === undefined
    ? undefined : new PostgresLiveDraftRoomRepository(liveDraftClient);
  const postgresExportArtifactRepository = exportArtifactClient === undefined
    ? undefined : new PostgresExportArtifactRepository(exportArtifactClient);
  const postgresInvitationRepository = sharedTransactionalClient === undefined
    ? undefined : new PostgresPlatformInvitationRepository(sharedTransactionalClient);
  const postgresLiveDraftRoomSetupRepository = options.postgresClient === undefined
    ? undefined : new PostgresLiveDraftRoomSetupRepository(options.postgresClient);
  const authRepository = options.authRepository ?? postgresAuthRepository ?? store.authRepository;
  const historicalImportRepository = options.historicalImportRepository ??
    postgresHistoricalImportRepository ?? store.historicalImports;
  if (authRepository !== store.authRepository) store.clearAuthSnapshotState();
  if (historicalImportRepository !== store.historicalImports) store.clearHistoricalImportSnapshotState();

  return {
    ...loaded,
    authRepository,
    leagueSetupRepository: options.leagueSetupRepository ?? postgresLeagueSetupRepository ?? store,
    historicalImportRepository,
    jobRepository: options.jobRepository ?? postgresJobQueue ?? store.jobs,
    simulationRepository: options.simulationRepository ?? postgresSimulationRepository ?? store.simulations,
    practiceShortlistRepository: options.practiceShortlistRepository ??
      postgresPracticeShortlistRepository ?? store.practiceShortlists,
    liveDraftRoomRepository: options.liveDraftRoomRepository ??
      postgresLiveDraftRoomRepository ?? store.liveDraftRooms,
    exportArtifactRepository: options.exportArtifactRepository ??
      postgresExportArtifactRepository ?? store.exportArtifacts,
    invitationRepository: options.invitationRepository ?? postgresInvitationRepository ??
      new InMemoryPlatformInvitationRepository(),
    onboardingRepository: options.onboardingRepository ??
      (options.postgresClient === undefined
        ? new InMemoryPlatformOnboardingRepository(() => store.onboardingSnapshot())
        : new PostgresPlatformOnboardingRepository(options.postgresClient)),
    liveDraftRoomSetupRepository: options.liveDraftRoomSetupRepository ??
      postgresLiveDraftRoomSetupRepository ?? store.liveDraftRoomSetups,
    ...(postgresAuthRepository === undefined ? {} : { postgresAuthRepository }),
    ...(postgresLeagueSetupRepository === undefined ? {} : { postgresLeagueSetupRepository }),
    ...(postgresHistoricalImportRepository === undefined ? {} : { postgresHistoricalImportRepository }),
    ...(postgresJobQueue === undefined ? {} : { postgresJobQueue }),
    ...(postgresSimulationRepository === undefined ? {} : { postgresSimulationRepository }),
    ...(postgresPracticeShortlistRepository === undefined ? {} : { postgresPracticeShortlistRepository }),
    ...(postgresLiveDraftRoomRepository === undefined ? {} : { postgresLiveDraftRoomRepository }),
    ...(postgresExportArtifactRepository === undefined ? {} : { postgresExportArtifactRepository }),
    ...(postgresInvitationRepository === undefined ? {} : { postgresInvitationRepository }),
    ...(postgresLiveDraftRoomSetupRepository === undefined ? {} : { postgresLiveDraftRoomSetupRepository }),
  };
};
