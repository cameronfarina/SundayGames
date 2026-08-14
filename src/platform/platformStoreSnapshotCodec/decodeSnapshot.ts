import type { InMemoryPlatformStoreSnapshot } from "../platformApp.js";
import { authValue } from "./decoding/auth.js";
import { historicalBatchValue, historicalSaleValue } from "./decoding/historical.js";
import { jobValue } from "./decoding/jobs.js";
import {
  leagueCreationRecordValue,
  leagueSeasonValue,
  membershipValue,
} from "./decoding/league.js";
import { liveRoomSetupValue, liveRoomValue } from "./decoding/liveRooms.js";
import { mockSessionValue } from "./decoding/mockSessions.js";
import {
  exportArtifactContentValue,
  exportArtifactValue,
  shortlistItemValue,
} from "./decoding/other.js";
import { pricingSnapshotValue } from "./decoding/pricing.js";
import {
  invalidSnapshot,
  optionalArrayValue,
  recordValue,
} from "./decoding/primitives.js";
import { simulationRunValue } from "./decoding/simulations.js";
import { emptyPlatformStoreSnapshot } from "./emptySnapshot.js";

export const deserializePlatformStoreSnapshot = (
  value: unknown,
): InMemoryPlatformStoreSnapshot => {
  const file = recordValue(value, "root");
  if (file.schemaVersion !== undefined && file.schemaVersion !== 1) {
    return invalidSnapshot("schemaVersion");
  }
  const empty = emptyPlatformStoreSnapshot();
  return {
    auth: file.auth === undefined || file.auth === null
      ? empty.auth
      : authValue(file.auth, "auth"),
    leagueSeasons: optionalArrayValue(file.leagueSeasons, "leagueSeasons", leagueSeasonValue),
    leagueCreationRecords: optionalArrayValue(file.leagueCreationRecords, "leagueCreationRecords", leagueCreationRecordValue),
    memberships: optionalArrayValue(file.memberships, "memberships", membershipValue),
    mockDraftSessions: optionalArrayValue(file.mockDraftSessions, "mockDraftSessions", mockSessionValue),
    simulationRuns: optionalArrayValue(file.simulationRuns, "simulationRuns", simulationRunValue),
    practiceShortlistItems: optionalArrayValue(file.practiceShortlistItems, "practiceShortlistItems", shortlistItemValue),
    liveDraftRooms: optionalArrayValue(file.liveDraftRooms, "liveDraftRooms", liveRoomValue),
    liveDraftRoomSetups: optionalArrayValue(file.liveDraftRoomSetups, "liveDraftRoomSetups", liveRoomSetupValue),
    historicalImportBatches: optionalArrayValue(file.historicalImportBatches, "historicalImportBatches", historicalBatchValue),
    historicalSaleRecords: optionalArrayValue(file.historicalSaleRecords, "historicalSaleRecords", historicalSaleValue),
    pricingSnapshots: optionalArrayValue(file.pricingSnapshots, "pricingSnapshots", pricingSnapshotValue),
    jobs: optionalArrayValue(file.jobs, "jobs", jobValue),
    exportArtifacts: optionalArrayValue(file.exportArtifacts, "exportArtifacts", exportArtifactValue),
    exportArtifactContents: optionalArrayValue(file.exportArtifactContents, "exportArtifactContents", exportArtifactContentValue),
  };
};
