import type { AuthMailSender, AuthRepository, SignupNotifier } from "../../auth.js";
import type { ExportArtifactRepository } from "../../exportArtifacts.js";
import type { HistoricalImportRepository } from "../../historicalImports.js";
import type { JobRepository } from "../../jobs.js";
import type { LeagueSetupRepository } from "../../leagueSetup.js";
import type { LiveDraftRoomRepository } from "../../liveDraftRooms.js";
import type { MockDraftSessionRepository } from "../../mockSessions.js";
import type { PracticeShortlistRepository } from "../../practiceShortlists.js";
import type {
  SimulationMockBatchRunner,
  SimulationRepository,
} from "../../simulations.js";
import type { InMemoryPlatformStore } from "../store/InMemoryPlatformStore.js";
import type { SeasonSimulationRunner } from "../../seasonSimulationRunner.js";
import type { SeasonSimulationAdmissionRepository } from "../../seasonSimulationAdmissions.js";

export interface PlatformAppOptions {
  store?: InMemoryPlatformStore | undefined;
  authRepository?: AuthRepository | undefined;
  authEmail?: {
    verificationRequired: boolean;
    mailSender?: AuthMailSender | undefined;
    publicBaseUrl?: string | undefined;
    signupNotifier?: SignupNotifier | undefined;
  } | undefined;
  leagueSetupRepository?: LeagueSetupRepository | undefined;
  historicalImportRepository?: HistoricalImportRepository | undefined;
  jobRepository?: JobRepository | undefined;
  simulationRepository?: SimulationRepository | undefined;
  seasonSimulationAdmissionRepository?: SeasonSimulationAdmissionRepository | undefined;
  seasonSimulationProducerEnabled?: boolean | undefined;
  practiceShortlistRepository?: PracticeShortlistRepository | undefined;
  liveDraftRoomRepository?: LiveDraftRoomRepository | undefined;
  mockDraftSessionRepository?: MockDraftSessionRepository | undefined;
  exportArtifactRepository?: ExportArtifactRepository | undefined;
  simulationRunner: SimulationMockBatchRunner;
  seasonSimulationRunner?: SeasonSimulationRunner | undefined;
}
