import { InMemoryAuthRepository } from "../../../auth.js";
import { InMemoryExportArtifactRepository } from "../../../exportArtifacts.js";
import { InMemoryFantasyProsRepository } from "../../../fantasyPros.js";
import { InMemoryHistoricalImportRepository } from "../../../historicalImports.js";
import { InMemoryJobQueue } from "../../../jobs.js";
import { InMemoryLeagueConnectionRepository } from "../../../leagueConnections.js";
import { InMemoryLiveDraftRoomRepository } from "../../../liveDraftRooms.js";
import { InMemoryLiveDraftRoomSetupRepository } from "../../../liveDraftRoomSetups.js";
import { InMemoryMockDraftSessionRepository } from "../../../mockSessions.js";
import { InMemoryPlayerNewsRepository } from "../../../playerNews.js";
import { InMemoryPracticeShortlistRepository } from "../../../practiceShortlists.js";
import {
  createInMemoryPricingSnapshotRepository,
  type PricingSnapshotRepository,
} from "../../../pricingSnapshots.js";
import { InMemorySimulationRepository } from "../../../simulations.js";
import type { InMemoryPlatformStoreOptions } from "../../contracts/store.js";
import type { LeagueMemoryState } from "../leagueMemoryState.js";
import { createLiveDraftRoomAuthorizer } from "./leagueQueries.js";

export class InMemoryPlatformRepositories {
  readonly authRepository = new InMemoryAuthRepository();
  readonly exportArtifacts = new InMemoryExportArtifactRepository();
  readonly historicalImports = new InMemoryHistoricalImportRepository();
  readonly jobs = new InMemoryJobQueue();
  readonly mockDraftSessions: InMemoryMockDraftSessionRepository;
  readonly pricingSnapshots: PricingSnapshotRepository = createInMemoryPricingSnapshotRepository();
  readonly simulations = new InMemorySimulationRepository();
  readonly practiceShortlists = new InMemoryPracticeShortlistRepository();
  readonly playerNews = new InMemoryPlayerNewsRepository();
  readonly fantasyPros = new InMemoryFantasyProsRepository();
  readonly leagueConnections = new InMemoryLeagueConnectionRepository();
  readonly liveDraftRooms: InMemoryLiveDraftRoomRepository;
  readonly liveDraftRoomSetups = new InMemoryLiveDraftRoomSetupRepository();

  constructor(
    protected readonly leagueState: LeagueMemoryState,
    options: InMemoryPlatformStoreOptions,
  ) {
    this.mockDraftSessions = new InMemoryMockDraftSessionRepository(
      [],
      options.mockDraftSessionResourcePolicy,
    );
    this.liveDraftRooms = new InMemoryLiveDraftRoomRepository(
      createLiveDraftRoomAuthorizer(leagueState),
    );
  }
}
