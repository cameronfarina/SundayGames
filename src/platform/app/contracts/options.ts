import type { AuthMailSender, AuthRepository } from "../../auth.js";
import type { ExportArtifactRepository } from "../../exportArtifacts.js";
import type { HistoricalImportRepository } from "../../historicalImports.js";
import type { JobRepository } from "../../jobs.js";
import type { LeagueSetupRepository } from "../../leagueSetup.js";
import type { LiveDraftRoomRepository } from "../../liveDraftRooms.js";
import type { PracticeShortlistRepository } from "../../practiceShortlists.js";
import type {
  SimulationMockBatchRunner,
  SimulationRepository,
} from "../../simulations.js";
import type { InMemoryPlatformStore } from "../store/InMemoryPlatformStore.js";

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
