import { createAuthService, type AuthRepository } from "../../auth.js";
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
import type { AccountAccess } from "./accountAccess.js";
import type { MembershipAccess } from "./membershipAccess.js";
import type { MockResultAccess } from "./mockResultAccess.js";
import type { PrivateTeamAccess } from "./privateTeamAccess.js";
import type { SeasonAccess } from "./seasonAccess.js";

export interface PlatformAppDependencies {
  readonly store: InMemoryPlatformStore;
  readonly auth: ReturnType<typeof createAuthService>;
  readonly authRepository: AuthRepository;
  readonly leagueSetup: LeagueSetupRepository;
  readonly historicalImports: HistoricalImportRepository;
  readonly jobs: JobRepository;
  readonly simulations: SimulationRepository;
  readonly practiceShortlists: PracticeShortlistRepository;
  readonly liveDraftRooms: LiveDraftRoomRepository;
  readonly exportArtifacts: ExportArtifactRepository;
  readonly usesExternalLeagueSetup: boolean;
}

export interface PlatformAppContext
  extends PlatformAppDependencies, AccountAccess, MembershipAccess, PrivateTeamAccess,
    SeasonAccess, MockResultAccess {
  readonly simulationRunner: SimulationMockBatchRunner;
}
