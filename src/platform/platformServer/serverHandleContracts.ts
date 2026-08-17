import type { Server } from "node:http";
import type { AuthRepository } from "../auth.js";
import type { ExportArtifactRepository } from "../exportArtifacts.js";
import type { FilePlatformStore } from "../filePlatformStore.js";
import type { HistoricalImportRepository } from "../historicalImports.js";
import type { JobRepository } from "../jobs.js";
import type { LeagueSetupRepository } from "../leagueSetup.js";
import type { LiveDraftRoomSetupRepository, PostgresLiveDraftRoomSetupRepository } from "../liveDraftRoomSetups.js";
import type { LiveDraftRoomRepository } from "../liveDraftRooms.js";
import type { PlatformApp, PlatformHttpHandler } from "../platformHttp.js";
import type { PlatformDraftToolsAdapter } from "../platformDraftToolsAdapter.js";
import type { PlatformJobHandlers } from "../platformJobOrchestrator.js";
import type { PlatformOnboardingRepository } from "../platformOnboarding.js";
import type { PlatformInvitationRepository } from "../platformInvitations.js";
import type { PlayerNewsRepository } from "../playerNews.js";
import type { PracticeShortlistRepository } from "../practiceShortlists.js";
import type { PostgresAuthRepository } from "../postgresAuth.js";
import type { PostgresExportArtifactRepository } from "../postgresExportArtifacts.js";
import type { PostgresHistoricalImportRepository } from "../postgresHistoricalImports.js";
import type { PostgresJobQueue } from "../postgresJobQueue.js";
import type { PostgresLeagueSetupRepository } from "../postgresLeagueSetup.js";
import type { PostgresLiveDraftRoomRepository } from "../postgresLiveDraftRooms.js";
import type { PostgresPlatformInvitationRepository } from "../postgresPlatformInvitations.js";
import type { PostgresPlatformStore } from "../postgresPlatformStore.js";
import type { PostgresSimulationRepository } from "../postgresSimulations.js";
import type { SimulationRepository } from "../simulations.js";
import type { InMemoryPlatformStore } from "../platformApp.js";
import type { CreatePlatformServerOptions } from "./contracts.js";

export interface PlatformServer {
  server: Server;
  app: PlatformApp;
  store: InMemoryPlatformStore;
  authRepository: AuthRepository;
  leagueSetupRepository: LeagueSetupRepository;
  historicalImportRepository: HistoricalImportRepository;
  jobRepository: JobRepository;
  simulationRepository: SimulationRepository;
  practiceShortlistRepository: PracticeShortlistRepository;
  playerNewsRepository: PlayerNewsRepository;
  liveDraftRoomRepository: LiveDraftRoomRepository;
  exportArtifactRepository: ExportArtifactRepository;
  invitationRepository: PlatformInvitationRepository;
  onboardingRepository: PlatformOnboardingRepository;
  liveDraftRoomSetupRepository?: LiveDraftRoomSetupRepository | undefined;
  handler: PlatformHttpHandler;
  draftToolsAdapter: PlatformDraftToolsAdapter;
  jobHandlers: PlatformJobHandlers;
  fileStore?: FilePlatformStore | undefined;
  postgresStore?: PostgresPlatformStore | undefined;
  postgresAuthRepository?: PostgresAuthRepository | undefined;
  postgresLeagueSetupRepository?: PostgresLeagueSetupRepository | undefined;
  postgresHistoricalImportRepository?: PostgresHistoricalImportRepository | undefined;
  postgresJobQueue?: PostgresJobQueue | undefined;
  postgresSimulationRepository?: PostgresSimulationRepository | undefined;
  postgresLiveDraftRoomRepository?: PostgresLiveDraftRoomRepository | undefined;
  postgresExportArtifactRepository?: PostgresExportArtifactRepository | undefined;
  postgresInvitationRepository?: PostgresPlatformInvitationRepository | undefined;
  postgresLiveDraftRoomSetupRepository?: PostgresLiveDraftRoomSetupRepository | undefined;
  persist: () => Promise<void>;
  close: () => Promise<void>;
}

export interface StartPlatformServerOptions extends CreatePlatformServerOptions {
  host?: string | undefined;
  port?: number | undefined;
}

export interface StartedPlatformServer extends PlatformServer {
  host: string;
  port: number;
  url: string;
}
