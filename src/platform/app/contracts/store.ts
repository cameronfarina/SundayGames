import type { AccountCredentialRecord, SessionRecord } from "../../auth.js";
import type { AccountOnboardingRecord } from "../../accountOnboarding.js";
import type { ExportArtifact, ExportArtifactContent } from "../../exportArtifacts.js";
import type {
  HistoricalImportBatch,
  HistoricalSaleRecord,
} from "../../historicalImports.js";
import type { JobRecord } from "../../jobs.js";
import type { LeagueSeason } from "../../leagueSeason.js";
import type {
  LeagueCreationLimits,
  LeagueCreationRecord,
  PlatformLeagueMembership,
} from "../../leagueSetup.js";
import type { LiveDraftRoom } from "../../liveDraftRooms.js";
import type { LiveDraftRoomSetup } from "../../liveDraftRoomSetups.js";
import type {
  MockDraftSession,
  MockDraftSessionResourcePolicy,
} from "../../mockSessions.js";
import type { PracticeShortlistItem } from "../../practiceShortlists.js";
import type { PricingSnapshot } from "../../pricingSnapshots.js";
import type { SimulationRun } from "../../simulations.js";

export interface InMemoryPlatformStoreSnapshot {
  auth: {
    accountCredentials: readonly AccountCredentialRecord[];
    sessions: readonly SessionRecord[];
  };
  accountOnboardingProfiles?: readonly AccountOnboardingRecord[];
  leagueSeasons: readonly LeagueSeason[];
  leagueCreationRecords?: readonly LeagueCreationRecord[];
  memberships: readonly PlatformLeagueMembership[];
  mockDraftSessions: readonly MockDraftSession[];
  simulationRuns: readonly SimulationRun[];
  practiceShortlistItems: readonly PracticeShortlistItem[];
  liveDraftRooms: readonly LiveDraftRoom[];
  liveDraftRoomSetups: readonly LiveDraftRoomSetup[];
  historicalImportBatches: readonly HistoricalImportBatch[];
  historicalSaleRecords: readonly HistoricalSaleRecord[];
  pricingSnapshots: readonly PricingSnapshot[];
  jobs: readonly JobRecord[];
  exportArtifacts: readonly ExportArtifact[];
  exportArtifactContents: readonly ExportArtifactContent[];
}

export interface InMemoryPlatformStoreOptions {
  leagueCreationLimits?: LeagueCreationLimits | undefined;
  mockDraftSessionResourcePolicy?: Partial<MockDraftSessionResourcePolicy> | undefined;
}
