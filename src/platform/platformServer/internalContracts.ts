import type { AuthRepository } from "../auth.js";
import type { ExportArtifactRepository } from "../exportArtifacts.js";
import type { FantasyProsRepository } from "../fantasyPros.js";
import type { FilePlatformStore } from "../filePlatformStore.js";
import type { HistoricalImportRepository } from "../historicalImports.js";
import type { JobRepository } from "../jobs.js";
import type { LeagueConnectionRepository } from "../leagueConnections.js";
import type { LeagueSetupRepository } from "../leagueSetup.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomSetup, LiveDraftRoomSetupRepository, PostgresLiveDraftRoomSetupRepository } from "../liveDraftRoomSetups.js";
import type { LiveDraftRoomRepository } from "../liveDraftRooms.js";
import type { PlatformApp, PlatformHttpHandler } from "../platformHttp.js";
import type { InMemoryPlatformStore } from "../platformApp.js";
import type { PlatformOnboardingRepository } from "../platformOnboarding.js";
import type { PlatformInvitationRepository } from "../platformInvitations.js";
import type { PlayerNewsRepository } from "../playerNews.js";
import type { PracticeShortlistRepository } from "../practiceShortlists.js";
import type { PracticePersistenceMode } from "../practicePersistenceMode.js";
import type { MockDraftSessionRepository } from "../mockSessions.js";
import type { PostgresAuthRepository } from "../postgresAuth.js";
import type { PostgresExportArtifactRepository } from "../postgresExportArtifacts.js";
import type { PostgresFantasyProsRepository } from "../postgresFantasyPros.js";
import type { PostgresHistoricalImportRepository } from "../postgresHistoricalImports.js";
import type { PostgresJobQueue } from "../postgresJobQueue.js";
import type { PostgresLeagueConnectionRepository } from "../postgresLeagueConnections.js";
import type { PostgresLeagueSetupRepository } from "../postgresLeagueSetup.js";
import type { PostgresLiveDraftRoomRepository } from "../postgresLiveDraftRooms.js";
import type { PostgresPlatformInvitationRepository } from "../postgresPlatformInvitations.js";
import type { PostgresPlatformStore } from "../postgresPlatformStore.js";
import type { PostgresPlayerNewsRepository } from "../postgresPlayerNews.js";
import type { PostgresPracticeShortlistRepository } from "../postgresPracticeShortlists.js";
import type { PostgresSimulationRepository } from "../postgresSimulations.js";
import type { PlatformJobHandlers } from "../platformJobOrchestrator.js";
import type { SimulationRepository } from "../simulations.js";

export interface LoadedPlatformStore {
  store: InMemoryPlatformStore;
  fileStore?: FilePlatformStore | undefined;
  postgresStore?: PostgresPlatformStore | undefined;
}

export interface RuntimeRepositories extends LoadedPlatformStore {
  authRepository: AuthRepository;
  leagueSetupRepository: LeagueSetupRepository;
  historicalImportRepository: HistoricalImportRepository;
  jobRepository: JobRepository;
  simulationRepository: SimulationRepository;
  mockDraftSessionRepository: MockDraftSessionRepository;
  mockDraftPersistenceMode: PracticePersistenceMode | "snapshot";
  practiceShortlistRepository: PracticeShortlistRepository;
  playerNewsRepository: PlayerNewsRepository;
  fantasyProsRepository: FantasyProsRepository;
  leagueConnectionRepository: LeagueConnectionRepository;
  liveDraftRoomRepository: LiveDraftRoomRepository;
  exportArtifactRepository: ExportArtifactRepository;
  invitationRepository: PlatformInvitationRepository;
  onboardingRepository: PlatformOnboardingRepository;
  liveDraftRoomSetupRepository: LiveDraftRoomSetupRepository;
  postgresAuthRepository?: PostgresAuthRepository | undefined;
  postgresLeagueSetupRepository?: PostgresLeagueSetupRepository | undefined;
  postgresHistoricalImportRepository?: PostgresHistoricalImportRepository | undefined;
  postgresJobQueue?: PostgresJobQueue | undefined;
  postgresSimulationRepository?: PostgresSimulationRepository | undefined;
  postgresPracticeShortlistRepository?: PostgresPracticeShortlistRepository | undefined;
  postgresPlayerNewsRepository?: PostgresPlayerNewsRepository | undefined;
  postgresFantasyProsRepository?: PostgresFantasyProsRepository | undefined;
  postgresLeagueConnectionRepository?: PostgresLeagueConnectionRepository | undefined;
  postgresLiveDraftRoomRepository?: PostgresLiveDraftRoomRepository | undefined;
  postgresExportArtifactRepository?: PostgresExportArtifactRepository | undefined;
  postgresInvitationRepository?: PostgresPlatformInvitationRepository | undefined;
  postgresLiveDraftRoomSetupRepository?: PostgresLiveDraftRoomSetupRepository | undefined;
}

export interface PlatformRuntime extends RuntimeRepositories {
  app: PlatformApp;
  platformHandler: PlatformHttpHandler;
  rawJobHandlers: PlatformJobHandlers;
  liveDraftRoomSetupProvider: (season: LeagueSeason) => Promise<LiveDraftRoomSetup | null>;
}

export type PlatformRuntimeFactory = (loadedStore: LoadedPlatformStore) => PlatformRuntime;

export interface PlatformRuntimeHolder {
  current(): PlatformRuntime;
  replace(runtime: PlatformRuntime): void;
}

export const createPlatformRuntimeHolder = (): PlatformRuntimeHolder => {
  let runtime: PlatformRuntime | undefined;

  return {
    current: () => {
      if (runtime === undefined) throw new Error("Platform runtime has not been initialized.");
      return runtime;
    },
    replace: replacement => {
      runtime = replacement;
    },
  };
};
