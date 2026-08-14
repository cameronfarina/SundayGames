import type { InMemoryPlatformStoreSnapshot } from "../platformApp.js";

export const emptyPlatformStoreSnapshot = (): InMemoryPlatformStoreSnapshot => ({
  auth: { accountCredentials: [], sessions: [] },
  leagueSeasons: [],
  leagueCreationRecords: [],
  memberships: [],
  mockDraftSessions: [],
  simulationRuns: [],
  practiceShortlistItems: [],
  liveDraftRooms: [],
  liveDraftRoomSetups: [],
  historicalImportBatches: [],
  historicalSaleRecords: [],
  pricingSnapshots: [],
  jobs: [],
  exportArtifacts: [],
  exportArtifactContents: [],
});
